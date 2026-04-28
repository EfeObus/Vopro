module Api
  module V1
    class EventsController < ApplicationController
      before_action :authenticate_user!

      MAX_EVENTS_PER_BATCH = 500
      MAX_PAYLOAD_BYTES = 1.megabyte
      ISO8601 = /\A\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})\z/

      # POST /api/v1/events/batch
      # Accepts a batch of masked events from the desktop agent.
      def create_batch
        if request.content_length && request.content_length > MAX_PAYLOAD_BYTES
          return render_error(
            status: :payload_too_large,
            code: "payload_too_large",
            message: "Request body exceeds the maximum allowed size",
            details: { max_bytes: MAX_PAYLOAD_BYTES }
          )
        end

        batch = params.require(:events)
        device_id = params.require(:device_id).to_s

        unless device_id.length.between?(1, 64)
          return render_error(
            status: :bad_request,
            code: "invalid_device_id",
            message: "device_id must be 1..64 chars"
          )
        end

        unless batch.is_a?(Array)
          return render_error(
            status: :bad_request,
            code: "invalid_events",
            message: "events must be an array"
          )
        end

        if batch.length > MAX_EVENTS_PER_BATCH
          return render_error(
            status: :payload_too_large,
            code: "batch_too_large",
            message: "Too many events in one batch",
            details: { max_events: MAX_EVENTS_PER_BATCH }
          )
        end

        accepted, rejected = sanitize(batch)

        if accepted.empty?
          return render_error(
            status: :unprocessable_entity,
            code: "no_valid_events",
            message: "No valid events in the batch",
            details: { accepted: 0, rejected: rejected }
          )
        end

        job_id = IngestEventBatchJob.perform_async(
          current_user.workspace_id,
          current_user.id,
          device_id,
          accepted
        )

        render json: {
          accepted: accepted.length,
          rejected: rejected,
          job_id: job_id
        }, status: :accepted
      end

      private

      # Validates each event, returning [accepted_array, rejected_count].
      def sanitize(batch)
        accepted = []
        rejected = 0
        batch.each do |raw|
          e = raw.respond_to?(:to_unsafe_h) ? raw.to_unsafe_h : raw
          unless e.is_a?(Hash) || e.is_a?(ActionController::Parameters)
            rejected += 1
            next
          end
          e = e.to_h.with_indifferent_access

          kind = e[:kind].to_s
          unless EventKind.valid?(kind)
            rejected += 1
            next
          end

          occurred_at = e[:occurred_at].to_s
          unless ISO8601.match?(occurred_at)
            rejected += 1
            next
          end

          payload = e[:payload]
          payload = payload.is_a?(Hash) ? payload : {}

          accepted << {
            "kind" => kind,
            "application" => e[:application].to_s.presence&.first(120),
            "url" => e[:url].to_s.presence&.first(2048),
            "target" => e[:target].to_s.presence&.first(500),
            "payload" => payload,
            "occurred_at" => occurred_at
          }
        end
        [accepted, rejected]
      end
    end
  end
end
