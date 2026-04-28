# frozen_string_literal: true

# Sentry is configured via SENTRY_DSN. When unset, the SDK becomes a no-op so
# development and tests stay quiet without further branching here.
return if ENV["SENTRY_DSN"].to_s.strip.empty?

require "sentry-ruby"
require "sentry-rails"
require "sentry-sidekiq"

Sentry.init do |config|
  config.dsn = ENV["SENTRY_DSN"]
  config.environment = ENV.fetch("SENTRY_ENVIRONMENT", Rails.env)
  config.release = ENV["SENTRY_RELEASE"] || ENV["GIT_SHA"]

  config.breadcrumbs_logger = %i[active_support_logger http_logger]
  config.send_default_pii = false

  # Tracing — keep low by default; tune per environment via SENTRY_TRACES_SAMPLE_RATE.
  config.traces_sample_rate = ENV.fetch("SENTRY_TRACES_SAMPLE_RATE", "0.05").to_f
  config.profiles_sample_rate = ENV.fetch("SENTRY_PROFILES_SAMPLE_RATE", "0.0").to_f

  # Drop noisy / expected exceptions before they leave the process.
  config.excluded_exceptions += %w[
    ActionController::RoutingError
    ActiveRecord::RecordNotFound
    ActionController::ParameterMissing
    AuthenticationService::InvalidToken
  ]

  config.before_send = lambda do |event, hint|
    # Strip Authorization headers / cookies if any leak into the event.
    if event.request
      event.request.headers&.delete("Authorization")
      event.request.headers&.delete("Cookie")
      event.request.cookies = nil
    end
    event
  end

  config.rails.report_rescued_exceptions = false
end
