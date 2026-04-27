class RefreshSopJob
  include Sidekiq::Job
  sidekiq_options queue: :low, retry: 2

  # Walks every published SOP and asks the ai-engine whether the underlying
  # workflow has drifted enough to warrant a new version.
  def perform
    Sop.where(status: "published").find_each do |sop|
      next unless sop.workflow

      events = sop.workflow.workflow_events.recent(7.days.ago).order(:occurred_at).map do |e|
        { kind: e.kind, application: e.application, target: e.target, occurred_at: e.occurred_at.iso8601 }
      end

      next if events.empty?

      result = AiEngineClient.generate_sop(
        workflow: { id: sop.workflow_id, title: sop.title, application: sop.workflow.application },
        events: events
      )

      next unless drift?(sop, result)

      sop.update!(status: "needs_review", steps: result["steps"], confidence: result["confidence"])
      SopVersion.create!(
        sop: sop,
        version: sop.next_version_number,
        authored_by: "Vopro AI",
        summary: "Drift detected — proposed update from recent runs.",
        snapshot: sop.as_versioned_snapshot
      )
    end
  end

  private

  def drift?(sop, result)
    Array(result["steps"]).map { |s| s["title"] } != Array(sop.steps).map { |s| s["title"] }
  end
end
