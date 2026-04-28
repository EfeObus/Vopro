module Api
  module V1
    class InvitationsController < ApplicationController
      before_action :authenticate_user!, only: %i[create index destroy]
      before_action :require_admin!,     only: %i[create index destroy]

      def index
        invitations = current_user.workspace.invitations.active.order(created_at: :desc)
        render json: invitations.map { |inv| serialize(inv) }
      end

      def create
        email = params.require(:email).to_s.strip.downcase
        role  = params.fetch(:role, "viewer").to_s

        unless Invitation::ROLES.include?(role)
          return render_error(
            status: :unprocessable_entity,
            code: "invalid_role",
            message: "Invalid role",
            details: { allowed_roles: Invitation::ROLES }
          )
        end

        if User.where("LOWER(email) = ?", email).exists?
          return render_error(
            status: :conflict,
            code: "user_exists",
            message: "A user with this email already exists"
          )
        end

        ws = current_user.workspace
        if ws.claimed_domain.present?
          invite_domain = email.split("@").last.to_s.downcase.sub(/\Awww\./, "")
          claimed = ws.claimed_domain.to_s.downcase.sub(/\Awww\./, "")
          if invite_domain != claimed
            return render_error(
              status: :unprocessable_entity,
              code: "domain_mismatch",
              message: "Invitation email must use the organization's claimed domain",
              details: { claimed_domain: claimed }
            )
          end
        end

        invitation = current_user.workspace.invitations.create!(
          email: email,
          role: role,
          inviter: current_user
        )

        AuditLogger.record(
          workspace: current_user.workspace,
          user: current_user,
          action: "invitation.created",
          subject_type: "Invitation",
          subject_id: invitation.id,
          metadata: { email: email, role: role },
          request: request
        )

        render json: serialize(invitation, include_token: true), status: :created
      end

      def destroy
        invitation = current_user.workspace.invitations.find(params[:id])
        invitation.update!(revoked_at: Time.current)
        AuditLogger.record(
          workspace: current_user.workspace,
          user: current_user,
          action: "invitation.revoked",
          subject_type: "Invitation",
          subject_id: invitation.id,
          request: request
        )
        head :no_content
      end

      # Public: GET /auth/invitations/:token — validate without consuming.
      def show
        invitation = Invitation.find_by!(token: params[:token])
        unless invitation.usable?
          return render_error(
            status: :gone,
            code: "invitation_expired",
            message: "Invitation is no longer valid"
          )
        end

        render json: {
          email: invitation.email,
          role: invitation.role,
          workspaceName: invitation.workspace.name
        }
      end

      # Public: POST /auth/invitations/:token/accept { name, password }
      def accept
        invitation = Invitation.find_by!(token: params[:token])
        unless invitation.usable?
          return render_error(
            status: :gone,
            code: "invitation_expired",
            message: "Invitation is no longer valid"
          )
        end

        name = params.require(:name).to_s.strip
        password = params.require(:password).to_s
        if password.length < 12
          return render_error(
            status: :unprocessable_entity,
            code: "weak_password",
            message: "Password must be at least 12 characters",
            details: { min_length: 12 }
          )
        end

        ActiveRecord::Base.transaction do
          user = User.create!(
            workspace: invitation.workspace,
            email: invitation.email,
            name: name,
            role: invitation.role,
            password: password
          )
          invitation.update!(accepted_at: Time.current)

          AuditLogger.record(
            workspace: invitation.workspace,
            user: user,
            action: "invitation.accepted",
            subject_type: "User",
            subject_id: user.id,
            request: request
          )

          token = AuthenticationService.issue_token(user)
          render json: { token: token, user: UserSerializer.call(user) }, status: :created
        end
      end

      private

      def require_admin!
        return if current_user&.admin?

        render_error(
          status: :forbidden,
          code: "forbidden",
          message: "Admin role required for this action"
        )
      end

      def serialize(invitation, include_token: false)
        payload = {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          inviterId: invitation.inviter_id,
          expiresAt: invitation.expires_at.iso8601,
          acceptedAt: invitation.accepted_at&.iso8601,
          revokedAt: invitation.revoked_at&.iso8601,
          createdAt: invitation.created_at.iso8601
        }
        payload[:token] = invitation.token if include_token
        payload
      end
    end
  end
end
