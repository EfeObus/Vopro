# frozen_string_literal: true

# Rack::Cors MUST wrap responses before SecureHeaders::Middleware. If Cors is
# registered too early (e.g. insert_before 0 in application.rb), SecureHeaders
# still inserts itself as the outermost middleware during gem init so OPTIONS
# preflight / POST responses can lack Access-Control-Allow-Origin — browsers
# then block login from http://127.0.0.1:5173 → http://127.0.0.1:3000.
#
# This initializer is named zz_* so it runs after secure_headers.rb alphabetically.

# fetch(...) treats ALLOWED_ORIGINS="" as set — use .presence so blank falls back.
raw_origins =
  ENV["ALLOWED_ORIGINS"].presence ||
  "http://localhost:5173,http://127.0.0.1:5173"

origins_list =
  raw_origins.split(",").map(&:strip).reject(&:empty?)

# localhost vs 127.0.0.1 are different origins; merge both for dev/test/CI so
# Vitest and browsers using either hostname always match (unless production).
unless Rails.env.production?
  %w[http://localhost:5173 http://127.0.0.1:5173].each do |dev_origin|
    origins_list << dev_origin unless origins_list.include?(dev_origin)
  end
end

Rails.application.config.middleware.insert_before SecureHeaders::Middleware, Rack::Cors do
  allow do
    origins origins_list
    resource "*",
             headers: :any,
             expose: %w[Authorization],
             methods: %i[get post put patch delete options head],
             max_age: 600
  end
end
