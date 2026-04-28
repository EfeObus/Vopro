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

    config.middleware.insert_before 0, Rack::Cors do
      allow do
        # localhost and 127.0.0.1 are different browser origins — include both
        # so Vite dev works whether you open http://localhost:5173 or ://127.0.0.1:5173.
        origins ENV.fetch(
          "ALLOWED_ORIGINS",
          "http://localhost:5173,http://127.0.0.1:5173",
        ).split(",").map(&:strip).reject(&:empty?)
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
