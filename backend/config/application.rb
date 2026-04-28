require_relative "boot"

require "rails"
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "action_controller/railtie"
require "action_view/railtie"
require "action_mailer/railtie"
require "rails/test_unit/railtie"

Bundler.require(*Rails.groups)

module Vopro
  class Application < Rails::Application
    config.load_defaults 7.1
    config.api_only = true
    config.time_zone = "UTC"
    config.active_record.default_timezone = :utc

    config.active_job.queue_adapter = :sidekiq

    # Browser treats localhost vs 127.0.0.1 as different origins. Many developers
    # still have ALLOWED_ORIGINS=http://localhost:5173 only in .env — so in
    # development we always merge both Vite URLs even when .env omits 127.0.0.1.
    cors_origins =
      ENV.fetch("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
          .split(",")
          .map(&:strip)
          .reject(&:empty?)

    if Rails.env.development?
      %w[http://localhost:5173 http://127.0.0.1:5173].each do |dev_origin|
        cors_origins << dev_origin unless cors_origins.include?(dev_origin)
      end
    end

    config.middleware.insert_before 0, Rack::Cors do
      allow do
        origins cors_origins
        resource "*",
                 headers: :any,
                 expose: %w[Authorization],
                 methods: %i[get post put patch delete options head]
      end
    end

    config.middleware.use Rack::Attack

    config.autoload_paths << Rails.root.join("lib")
  end
end
