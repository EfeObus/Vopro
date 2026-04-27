class IngestEventBatchJob
  include Sidekiq::Job
  sidekiq_options queue: :default, retry: 5

  def perform(workspace_id, user_id, device_id, events)
    workspace = Workspace.find(workspace_id)
    user = User.find(user_id)

    rows = events.map do |e|
      {
        workspace_id: workspace.id,
        user_id: user.id,
        device_id: device_id,
        kind: e["kind"],
        application: e["application"],
        url: e["url"],
        target: e["target"],
        payload: MaskingService.scrub(e["payload"] || {}),
        occurred_at: e["occurred_at"],
        created_at: Time.current,
        updated_at: Time.current
      }
    end

    WorkflowEvent.insert_all(rows) if rows.any?
  end
end
