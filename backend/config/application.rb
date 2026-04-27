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
        origins ENV.fetch("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
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
