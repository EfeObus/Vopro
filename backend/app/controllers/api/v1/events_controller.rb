module Api
  module V1
    class EventsController < ApplicationController
      before_action :authenticate_user!

      # POST /api/v1/events/batch
      # Accepts a batch of masked events from the desktop agent.
      # Body shape:
      # {
      #   device_id: "uuid",
      #   captured_at: "2026-04-27T19:00:00Z",
      #   events: [
      #     { kind: "click", application: "Salesforce",
      #       url: "https://...", target: "...", payload: {...},
      #       occurred_at: "2026-04-27T19:00:00.123Z" }
      #   ]
      # }
      def create_batch
        batch = params.require(:events)
        device_id = params.require(:device_id)

        accepted = IngestEventBatchJob.perform_async(
          current_user.workspace_id,
          current_user.id,
          device_id,
          batch.as_json
        )

        render json: { accepted: batch.length, job_id: accepted }, status: :accepted
      end
    end
  end
end
