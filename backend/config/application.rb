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

    # Rack::Cors is registered in config/initializers/zz_rack_cors.rb **after**
    # SecureHeaders loads so we can insert_before SecureHeaders::Middleware.
    # Putting Cors in this file with insert_before 0 still ends up *inside*
    # SecureHeaders because the gem inserts itself outermost during boot — which
    # broke browser preflights (no Access-Control-Allow-Origin on OPTIONS).

    config.middleware.use Rack::Attack

    config.autoload_paths << Rails.root.join("lib")
  end
end
