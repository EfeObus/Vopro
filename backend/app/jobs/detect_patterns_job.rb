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

      result = AiEngineClient.detect_patterns(events: events)

      Array(result["candidates"]).each do |candidate|
        workflow = workspace.workflows.find_or_initialize_by(signature: candidate["signature"])
        workflow.assign_attributes(
          title: candidate["title"],
          application: candidate["application"],
          occurrences: candidate["occurrences"],
          last_seen_at: Time.zone.parse(candidate["last_seen"].to_s),
          confidence: candidate["confidence"],
          status: workflow.persisted? ? workflow.status : "pending"
        )
        workflow.save!
      end
    end
  end
end
