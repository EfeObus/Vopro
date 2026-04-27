# Rate limiting and abuse protection. Backed by Redis so limits hold across
# multiple Puma processes / pods.

class Rack::Attack
  cache.store = ActiveSupport::Cache::RedisCacheStore.new(
    url: ENV.fetch("REDIS_URL", "redis://localhost:6379/2")
  )

  # Allow localhost during development.
  Rack::Attack.safelist("allow-localhost") do |req|
    %w[127.0.0.1 ::1].include?(req.ip) && Rails.env.development?
  end

  # Auth login: 5 attempts / minute / IP. Stops credential stuffing dead.
  throttle("login/ip", limit: 5, period: 1.minute) do |req|
    req.ip if req.path == "/api/v1/auth/login" && req.post?
  end

  # Auth login by email: 10 attempts / 5 minutes / email
  throttle("login/email", limit: 10, period: 5.minutes) do |req|
    if req.path == "/api/v1/auth/login" && req.post?
      req.params["email"].to_s.downcase.presence
    end
  end

  # Event ingestion: tight per-device limit. The agent should never legitimately
  # exceed this; flooding suggests a bug or a compromised key.
  throttle("events/device", limit: 30, period: 1.minute) do |req|
    if req.path == "/api/v1/events/batch" && req.post?
      req.env["HTTP_X_VOPRO_DEVICE_ID"].presence ||
        (req.env["RAW_POST_DATA"] && JSON.parse(req.env["RAW_POST_DATA"])["device_id"] rescue nil)
    end
  end

  # General API: 600 requests / 5 min / IP — generous, but stops scraping.
  throttle("api/ip", limit: 600, period: 5.minutes) do |req|
    req.ip if req.path.start_with?("/api/")
  end

  self.throttled_responder = lambda do |request|
    match_data = request.env["rack.attack.match_data"]
    retry_after = match_data ? match_data[:period] : 60

    [
      429,
      {
        "Content-Type" => "application/json",
        "Retry-After" => retry_after.to_s
      },
      [{ error: "Too many requests", retry_after: retry_after }.to_json]
    ]
  end

  ActiveSupport::Notifications.subscribe("throttle.rack_attack") do |_n, _s, _f, _id, payload|
    req = payload[:request]
    Rails.logger.warn("[rack-attack] throttled #{req.env['rack.attack.matched']} ip=#{req.ip}")
  end
end
