module Api
  module V1
    # GDPR-style endpoints scoped to the calling user. Every action audits.
    class MeController < ApplicationController
      before_action :authenticate_user!

      # POST /api/v1/me/consents { consent_key: "workflow_capture_policy_v1" }
      def consent
        key = params.require(:consent_key).to_s
        unless UserConsent::KEYS.include?(key)
          return render_error(status: :bad_request, code: "bad_request", message: "Unknown consent key")
        end

        record = current_user.user_consents.find_or_initialize_by(consent_key: key)
        record.accepted_at = Time.current
        record.ip = request.remote_ip&.to_s.presence
        record.metadata = {}
        record.save!

        AuditLogger.record(
          workspace: current_user.workspace,
          user: current_user,
          action: "user.consent_recorded",
          subject_type: "UserConsent",
          subject_id: record.id,
          metadata: { consent_key: key },
          request: request
        )

        head :created
      end

      # GET /api/v1/me/export
      # Returns a JSON archive of everything we hold for this user.
      def export
        u = current_user
        events = u.workspace.workflow_events.where(user: u).limit(50_000)
        owned_sops = u.owned_sops
        recordings = u.call_recordings.order(created_at: :desc).limit(5_000)

        AuditLogger.record(
          workspace: u.workspace,
          user: u,
          action: "gdpr.export",
          subject_type: "User",
          subject_id: u.id,
          metadata: {
            events: events.size,
            sops: owned_sops.size,
            call_recordings: recordings.size
          },
          request: request
        )

        render json: {
          generatedAt: Time.current.iso8601,
          user: UserSerializer.call(u),
          workspace: { id: u.workspace.id, name: u.workspace.name },
          events: events.map { |e| event_export(e) },
          ownedSops: owned_sops.map { |s| SopSerializer.detail(s) },
          callRecordings: recordings.map { |r| call_recording_export(r) }
        }
      end

      # DELETE /api/v1/me
      # Right-to-erasure. We *anonymise* rather than hard-delete so the
      # workspace's analytics and SOP authorship stay coherent.
      # Hard-deletes the user's events and PII fields; preserves an
      # `anonymized_user` record with `deleted_at` set.
      def destroy
        u = current_user
        ActiveRecord::Base.transaction do
          u.workspace.workflow_events.where(user: u).delete_all
          u.call_recordings.destroy_all
          u.update!(
            email: "deleted-#{u.id}@anonymized.invalid",
            name: "Deleted user",
            password: SecureRandom.hex(32),
            deleted_at: Time.current,
            role: "viewer"
          )
        end

        AuditLogger.record(
          workspace: u.workspace,
          user: u,
          action: "gdpr.delete",
          subject_type: "User",
          subject_id: u.id,
          request: request
        )

        head :no_content
      end

      private

      def event_export(e)
        {
          id: e.id,
          kind: e.kind,
          application: e.application,
          url: e.url,
          target: e.target,
          payload: e.payload,
          occurredAt: e.occurred_at.iso8601
        }
      end

      def call_recording_export(r)
        {
          id: r.id,
          status: r.status,
          titleHint: r.title_hint,
          transcript: r.transcript,
          errorMessage: r.error_message,
          sopId: r.sop_id,
          metadata: r.metadata || {},
          createdAt: r.created_at.iso8601,
          updatedAt: r.updated_at.iso8601
        }
      end
    end
  end
end
