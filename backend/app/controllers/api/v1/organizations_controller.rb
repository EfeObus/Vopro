module Api
  module V1
    class OrganizationsController < ApplicationController
      before_action :authenticate_user!
      before_action :require_admin!

      # GET /api/v1/organization — billing + verification snapshot for admins.
      def show
        ws = current_user.workspace
        render json: OrganizationSnapshotSerializer.call(ws, seats_used: ws.users.kept.count)
      end

      # POST /api/v1/organization/domain_dns/start — issue TXT token for `_vopro.<domain>`.
      def start_dns_verification
        ws = current_user.workspace
        if ws.claimed_domain.blank?
          return render_error(status: :bad_request, code: "bad_request", message: "Workspace has no claimed domain")
        end

        tok = "vopro-verify=#{SecureRandom.hex(16)}"
        ws.update!(dns_verification_token: tok)

        AuditLogger.record(
          workspace: ws,
          user: current_user,
          action: "organization.dns_challenge_issued",
          subject_type: "Workspace",
          subject_id: ws.id,
          request: request
        )

        host = "#{DnsVerifier::SUBDOMAIN}.#{ws.claimed_domain}"
        render json: { dnsTxtHost: host, dnsTxtValue: tok }
      end

      # POST /api/v1/organization/domain_dns/verify — poll DNS TXT for token substring.
      def verify_dns
        ws = current_user.workspace
        if ws.claimed_domain.blank? || ws.dns_verification_token.blank?
          return render_error(
            status: :bad_request,
            code: "bad_request",
            message: "Start DNS verification first"
          )
        end

        ok = DnsVerifier.txt_records_include?(ws.claimed_domain, ws.dns_verification_token)
        unless ok
          return render_error(
            status: :unprocessable_entity,
            code: "dns_verification_failed",
            message: "TXT record not found yet — DNS can take a few minutes to propagate"
          )
        end

        ws.update!(domain_verified_at: Time.current, dns_verification_token: nil)

        AuditLogger.record(
          workspace: ws,
          user: current_user,
          action: "organization.domain_verified_dns",
          subject_type: "Workspace",
          subject_id: ws.id,
          request: request
        )

        render json: OrganizationSnapshotSerializer.call(ws, seats_used: ws.users.kept.count)
      end

      private

      def require_admin!
        return if current_user&.admin?

        render_error(status: :forbidden, code: "forbidden", message: "Admin role required for this action")
      end
    end
  end
end
