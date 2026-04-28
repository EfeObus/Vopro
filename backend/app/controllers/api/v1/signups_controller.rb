# frozen_string_literal: true

module Api
  module V1
    class SignupsController < ApplicationController
      # Public tenant registration — paired with email verification token.

      def create
        result = SignupService.perform(signup_params, frontend_origin: frontend_origin)
        unless result[:ok]
          err = result[:error]
          return render_error(
            status: err[:status],
            code: err[:code],
            message: err[:message],
            details: err[:details]
          )
        end

        workspace = result[:workspace]
        user = result[:user]

        jwt = AuthenticationService.issue_token(user)
        render json: {
          token: jwt,
          user: UserSerializer.call(user),
          workspace: OrganizationSnapshotSerializer.call(workspace, seats_used: workspace.users.kept.count)
        }, status: :created
      end

      def verify_email
        raw = params.require(:token).to_s
        rec = SignupEmailToken.usable.find_by(token: raw)
        unless rec
          return render_error(status: :gone, code: 'invalid_token', message: 'Verification link is invalid or expired')
        end

        ws = rec.workspace
        ActiveRecord::Base.transaction do
          ws.update!(domain_verified_at: Time.current)
          rec.consume!
        end

        render json: { ok: true, workspaceId: ws.id }
      end

      private

      def signup_params
        params.require(:signup).permit(
          :workspace_name,
          :slug,
          :claimed_domain,
          :admin_email,
          :admin_password,
          :admin_name,
          :billing_plan,
          :seats_limit
        )
      end

      def frontend_origin
        ENV.fetch('FRONTEND_ORIGIN', 'http://localhost:5173')
      end
    end
  end
end
