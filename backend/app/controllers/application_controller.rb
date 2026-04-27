class ApplicationController < ActionController::API
  rescue_from ActiveRecord::RecordNotFound, with: :not_found
  rescue_from ActiveRecord::RecordInvalid, with: :unprocessable
  rescue_from ActionController::ParameterMissing, with: :bad_request

  before_action :tag_request

  def append_info_to_payload(payload)
    super
    payload[:request_id] = request.request_id
    payload[:remote_ip]  = request.remote_ip
    payload[:user_id]    = current_user&.id
    payload[:workspace_id] = current_user&.workspace_id
  end

  private

  def tag_request
    Rails.logger.tagged(request.request_id) if Rails.logger.respond_to?(:tagged)
  end

  def current_user
    @current_user ||= AuthenticationService.user_from_request(request)
  end

  def authenticate_user!
    return if current_user

    render json: { error: "Unauthorized" }, status: :unauthorized
  end

  def not_found(error)
    render json: { error: error.message }, status: :not_found
  end

  def unprocessable(error)
    render json: { error: error.message, details: error.record&.errors }, status: :unprocessable_entity
  end

  def bad_request(error)
    render json: { error: error.message }, status: :bad_request
  end
end
