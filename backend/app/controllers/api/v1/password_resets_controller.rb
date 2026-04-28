module Api
  module V1
    class PasswordResetsController < ApplicationController
      MIN_PASSWORD_LENGTH = 12

      # POST /auth/password/forgot { email }
      # Always returns 202 to avoid disclosing whether the email exists.
      def create
        email = params.require(:email).to_s.strip.downcase
        user  = User.find_by("LOWER(email) = ?", email)

        if user
          token = user.password_reset_tokens.create!
          AuditLogger.record(
            workspace: user.workspace,
            user: user,
            action: "auth.password_reset_requested",
            subject_type: "User",
            subject_id: user.id,
            request: request
          )

          # In a real deployment a mailer would deliver the link; for now we
          # return the token in non-production envs so the flow is testable.
          if Rails.env.production?
            render json: { status: "sent" }, status: :accepted
          else
            render json: { status: "sent", token: token.token, expiresAt: token.expires_at.iso8601 },
                   status: :accepted
          end
        else
          render json: { status: "sent" }, status: :accepted
        end
      end

      # POST /auth/password/reset { token, password }
      def update
        token = PasswordResetToken.find_by!(token: params.require(:token))
        unless token.usable?
          return render_error(
            status: :gone,
            code: "reset_token_expired",
            message: "Reset token is no longer valid"
          )
        end

        password = params.require(:password).to_s
        if password.length < MIN_PASSWORD_LENGTH
          return render_error(
            status: :unprocessable_entity,
            code: "weak_password",
            message: "Password must be at least #{MIN_PASSWORD_LENGTH} characters",
            details: { min_length: MIN_PASSWORD_LENGTH }
          )
        end

        ActiveRecord::Base.transaction do
          token.user.update!(password: password)
          token.consume!
          # Invalidate any other outstanding tokens for the same user.
          token.user.password_reset_tokens.active.where.not(id: token.id).update_all(consumed_at: Time.current)

          AuditLogger.record(
            workspace: token.user.workspace,
            user: token.user,
            action: "auth.password_reset_completed",
            subject_type: "User",
            subject_id: token.user.id,
            request: request
          )
        end

        head :no_content
      end
    end
  end
end
