class GenerateSopJob
  include Sidekiq::Job
  sidekiq_options queue: :default, retry: 3

  def perform(workflow_id)
    workflow = Workflow.find(workflow_id)
    events = workflow.workflow_events.order(:occurred_at).limit(2_000).map do |e|
      {
        id: e.id,
        kind: e.kind,
        application: e.application,
        url: e.url,
        target: e.target,
        occurred_at: e.occurred_at.iso8601
      }
    end

    result = AiEngineClient.generate_sop(
      workflow: { id: workflow.id, title: workflow.title, application: workflow.application },
      events: events
    )

    sop = workflow.workspace.sops.find_or_initialize_by(workflow_id: workflow.id)
    sop.assign_attributes(
      title: result["title"] || workflow.title,
      description: result["description"],
      status: "draft",
      tags: result["tags"] || [],
      steps: result["steps"] || [],
      confidence: result["confidence"] || workflow.confidence,
      runs_observed: workflow.occurrences,
      contributors: result["contributors"] || 1,
      average_duration_sec: result["average_duration_sec"] || 0
    )
    sop.save!

    SopVersion.create!(
      sop: sop,
      version: sop.next_version_number,
      authored_by: "Vopro AI",
      summary: "Auto-generated from #{workflow.occurrences} captured runs.",
      snapshot: sop.as_versioned_snapshot
    )

    workflow.update!(status: "sop_generated")
  end
end
