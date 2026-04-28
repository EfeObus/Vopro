class ApplicationController < ActionController::API
  # `rescue_from` resolution walks bottom-to-top, so the catch-all StandardError
  # MUST be declared first — that way it is matched last, only when no more
  # specific handler applied. Anything not caught by a specific handler falls
  # through to `handle_internal_error` so we never leak a Ruby trace.
  rescue_from StandardError,                       with: :handle_internal_error

  # Sidekiq jobs (`perform_async`) and Redis-backed caches fail fast when Redis
  # is down — surface a clear 503 instead of a generic 500 (common local-dev gap).
  rescue_from RedisClient::CannotConnectError,     with: :handle_redis_unavailable
  rescue_from Redis::CannotConnectError,           with: :handle_redis_unavailable

  rescue_from ActiveRecord::RecordNotFound,        with: :handle_not_found
  rescue_from ActiveRecord::RecordInvalid,         with: :handle_unprocessable
  rescue_from ActiveRecord::RecordNotUnique,       with: :handle_conflict
  rescue_from ActionController::ParameterMissing,  with: :handle_bad_request
  rescue_from ActionController::UnpermittedParameters, with: :handle_bad_request
  rescue_from JSON::ParserError,                   with: :handle_bad_request
  rescue_from ActionController::RoutingError,      with: :handle_not_found

  # Authorization helper raises this; controllers can also `raise Forbidden`.
  class Forbidden < StandardError; end
  class Conflict < StandardError; end
  rescue_from Forbidden,                           with: :handle_forbidden
  rescue_from Conflict,                            with: :handle_conflict

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

    render_error(status: :unauthorized, code: "unauthorized", message: "Authentication required")
  end

  # ---------------------------------------------------------------------------
  # Public helper. Controllers should prefer this over hand-rolled
  # `render json: { error: ... }`. Keeps every API error on a single shape:
  #
  #   {
  #     "error": {
  #       "code":       "snake_case_machine_code",
  #       "message":    "Human-readable message",
  #       "status":     422,
  #       "request_id": "<rails_request_id>",
  #       "details":    { ... }   # optional, validation errors etc.
  #     }
  #   }
  # ---------------------------------------------------------------------------
  def render_error(status:, code:, message:, details: nil)
    body = {
      error: {
        code:       code.to_s,
        message:    message.to_s,
        status:     Rack::Utils.status_code(status),
        request_id: request.request_id,
      },
    }
    body[:error][:details] = details if details.present?
    render json: body, status: status
  end

  # ---- rescue handlers ------------------------------------------------------

  def handle_not_found(error)
    render_error(
      status: :not_found,
      code: "not_found",
      message: error.message.presence || "Resource not found",
    )
  end

  def handle_unprocessable(error)
    details = error.respond_to?(:record) && error.record ? error.record.errors.as_json : nil
    render_error(
      status: :unprocessable_entity,
      code: "unprocessable_entity",
      message: "Validation failed",
      details: details,
    )
  end

  def handle_bad_request(error)
    render_error(status: :bad_request, code: "bad_request", message: error.message)
  end

  def handle_forbidden(error)
    render_error(
      status: :forbidden,
      code: "forbidden",
      message: error.message.presence || "You do not have access to this resource",
    )
  end

  def handle_conflict(error)
    render_error(
      status: :conflict,
      code: "conflict",
      message: error.message.presence || "Resource state conflict",
    )
  end

  def handle_redis_unavailable(error)
    Rails.logger.error("[#{request.request_id}] #{error.class}: #{error.message}")

    hint =
      "Start Redis (e.g. `redis-server`, `brew services start redis`, or `docker compose up -d redis`), " \
      "then run a Sidekiq worker: `cd backend && bundle exec sidekiq`."

    message =
      if Rails.env.production?
        "Background jobs are temporarily unavailable. Please try again shortly."
      else
        "#{error.class}: #{error.message}. #{hint}"
      end

    details =
      if Rails.env.production?
        nil
      else
        { hint: hint }
      end

    render_error(
      status: :service_unavailable,
      code: "redis_unavailable",
      message: message,
      details: details,
    )
  end

  def handle_internal_error(error)
    # Always log with backtrace; report to Sentry if configured.
    Rails.logger.error("[#{request.request_id}] #{error.class}: #{error.message}")
    Rails.logger.error(error.backtrace.first(20).join("\n")) if error.backtrace
    if defined?(Sentry)
      Sentry.capture_exception(error, extra: { request_id: request.request_id })
    end

    # In dev/test surface the underlying message to keep debugging fast;
    # in production we never leak it.
    message =
      if Rails.env.production?
        "An unexpected error occurred"
      else
        "#{error.class}: #{error.message}"
      end

    render_error(status: :internal_server_error, code: "internal_error", message: message)
  end
end
