class DetectPatternsJob
  include Sidekiq::Job
  sidekiq_options queue: :default, retry: 3

  def perform(workspace_id = nil)
    Workspace.find_each do |workspace|
      next if workspace_id && workspace.id != workspace_id

      events = workspace.workflow_events.recent.order(:occurred_at).limit(10_000).map do |e|
        {
          id: e.id,
          user_id: e.user_id,
          kind: e.kind,
          application: e.application,
          url: e.url,
          target: e.target,
          occurred_at: e.occurred_at.iso8601
        }
      end

      next if events.empty?

      result = AiEngineClient.detect_patterns(events: events) || {}

      Array(result["candidates"]).compact.each do |candidate|
        process_candidate!(workspace, candidate)
      rescue StandardError => e
        Rails.logger.warn("[detect-patterns] skipped candidate: #{e.class}: #{e.message}")
      end
    end
  end

  private

  def process_candidate!(workspace, candidate)
    workflow = workspace.workflows.find_or_initialize_by(signature: candidate["signature"])
    is_new = workflow.new_record?
    workflow.assign_attributes(
      title: candidate["title"],
      application: candidate["application"],
      occurrences: candidate["occurrences"],
      last_seen_at: Time.zone.parse(candidate["last_seen"].to_s),
      confidence: candidate["confidence"],
      status: workflow.persisted? ? workflow.status : "pending"
    )
    workflow.save!

    link_events_to_workflow!(
      workspace,
      workflow,
      candidate
    )

    return unless is_new && workspace.auto_generate_sop? && workflow.status == "pending"

    GenerateSopJob.perform_async(workflow.id)
  end

  def link_events_to_workflow!(workspace, workflow, candidate)
    ids = Array(candidate["linked_event_ids"]).presence || Array(candidate["sample_event_ids"])
    ids = ids.map(&:to_s).uniq
    return if ids.empty?

    # Only attach unattributed events so overlapping patterns don't thrash assignments.
    workspace.workflow_events.where(id: ids, workflow_id: nil).update_all(
      workflow_id: workflow.id,
      updated_at: Time.current
    )
  end
end
