require "active_support/core_ext/integer/time"

Rails.application.configure do
  config.cache_classes = true
  config.eager_load = false
  config.public_file_server.enabled = true
  config.consider_all_requests_local = true
  config.action_controller.perform_caching = false
  # OAuth state and rate-limit counters round-trip through the cache, so
  # tests need a real (in-memory) backend.
  config.cache_store = :memory_store
  config.action_dispatch.show_exceptions = false
  config.active_support.deprecation = :stderr
end
