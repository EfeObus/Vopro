module Api
  module V1
    class AuthController < ApplicationController
      def login
        user = User.find_by(email: params.require(:email).downcase)
        if user&.authenticate(params.require(:password))
          token = AuthenticationService.issue_token(user)
          render json: { token: token, user: UserSerializer.call(user) }
        else
          render json: { error: "Invalid credentials" }, status: :unauthorized
        end
      end

      def refresh
        user = AuthenticationService.user_from_request(request)
        return render json: { error: "Unauthorized" }, status: :unauthorized unless user

        token = AuthenticationService.issue_token(user)
        render json: { token: token }
      end

      def me
        return render json: { error: "Unauthorized" }, status: :unauthorized unless current_user

        render json: UserSerializer.call(current_user)
      end
    end
  end
end
