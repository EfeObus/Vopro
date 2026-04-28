module Api
  module V1
    # GDPR-style endpoints scoped to the calling user. Every action audits.
    class MeController < ApplicationController
      before_action :authenticate_user!

      # GET /api/v1/me/export
      # Returns a JSON archive of everything we hold for this user.
      def export
        u = current_user
        events = u.workspace.workflow_events.where(user: u).limit(50_000)
        owned_sops = u.owned_sops

        AuditLogger.record(
          workspace: u.workspace,
          user: u,
          action: "gdpr.export",
          subject_type: "User",
          subject_id: u.id,
          metadata: { events: events.size, sops: owned_sops.size },
          request: request
        )

        render json: {
          generatedAt: Time.current.iso8601,
          user: UserSerializer.call(u),
          workspace: { id: u.workspace.id, name: u.workspace.name },
          events: events.map { |e| event_export(e) },
          ownedSops: owned_sops.map { |s| SopSerializer.detail(s) }
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
    end
  end
end
