module Api
  module V1
    class AuthController < ApplicationController
      def login
        email = params.require(:email).to_s.downcase
        user = User.kept.find_by(email: email)
        if user&.authenticate(params.require(:password))
          token = AuthenticationService.issue_token(user)
          AuditLogger.record(
            workspace: user.workspace,
            user: user,
            action: "auth.login",
            subject_type: "User",
            subject_id: user.id,
            request: request
          )
          render json: { token: token, user: UserSerializer.call(user) }
        else
          AuditLogger.record(
            workspace: user&.workspace,
            user: user,
            action: "auth.login_failed",
            subject_type: "User",
            subject_id: user&.id,
            metadata: { email: email },
            request: request
          )
          render_error(status: :unauthorized, code: "invalid_credentials", message: "Invalid credentials")
        end
      end

      def refresh
        user = AuthenticationService.user_from_request(request)
        return render_error(status: :unauthorized, code: "unauthorized", message: "Authentication required") unless user

        # Rotate: invalidate the presented token so a stolen JWT can't keep
        # being refreshed indefinitely.
        AuthenticationService.revoke_request_token!(request)
        token = AuthenticationService.issue_token(user)
        AuditLogger.record(
          workspace: user.workspace,
          user: user,
          action: "auth.refresh",
          subject_type: "User",
          subject_id: user.id,
          request: request
        )
        render json: { token: token }
      end

      def me
        return render_error(status: :unauthorized, code: "unauthorized", message: "Authentication required") unless current_user

        render json: UserSerializer.call(current_user)
      end

      def logout
        return render_error(status: :unauthorized, code: "unauthorized", message: "Authentication required") unless current_user

        AuthenticationService.revoke_request_token!(request)
        AuditLogger.record(
          workspace: current_user.workspace,
          user: current_user,
          action: "auth.logout",
          subject_type: "User",
          subject_id: current_user.id,
          request: request
        )
        head :no_content
      end
    end
  end
end
