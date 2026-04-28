# Sensible defaults for an API + dashboard. The frontend is a separate Vite
# app, so the CSP only needs to permit our own origin and the OAuth providers
# we redirect to. Override per-controller as needed.

SecureHeaders::Configuration.default do |config|
  config.x_frame_options = "DENY"
  config.x_content_type_options = "nosniff"
  config.x_xss_protection = "0"
  config.x_permitted_cross_domain_policies = "none"
  config.referrer_policy = %w[strict-origin-when-cross-origin]
  config.hsts = "max-age=#{1.year.to_i}; includeSubDomains"

  config.csp = {
    default_src: %w['self'],
    script_src:  %w['self' 'unsafe-inline'],
    style_src:   %w['self' 'unsafe-inline'],
    img_src:     %w['self' data: blob:],
    connect_src: %w['self'] + Array(ENV["ALLOWED_ORIGINS"]).first&.split(",").to_a,
    frame_src:   %w[https://accounts.google.com https://login.microsoftonline.com],
    frame_ancestors: %w['none'],
    form_action: %w['self' https://accounts.google.com https://login.microsoftonline.com],
    base_uri:    %w['self'],
    object_src:  %w['none']
  }

  # Cookie hardening. secure_headers 7.x requires each flag to be `true`, a
  # hash, or SecureHeaders::OPT_OUT — booleans like `false` are rejected. We
  # opt-out of `secure` in development (localhost is plain HTTP) and force it
  # everywhere else.
  config.cookies = {
    secure: Rails.env.development? ? SecureHeaders::OPT_OUT : true,
    httponly: true,
    samesite: { lax: true }
  }
end

# secure_headers 7.x dropped its Permissions-Policy DSL; emit the header
# ourselves through a tiny middleware so we still ship sensible defaults.
Rails.application.config.middleware.insert_before(
  ActionDispatch::Executor,
  Class.new do
    POLICY = "camera=(), geolocation=(), microphone=(), payment=(), usb=()".freeze

    def initialize(app)
      @app = app
    end

    def call(env)
      status, headers, body = @app.call(env)
      headers["Permissions-Policy"] ||= POLICY
      [status, headers, body]
    end
  end
)
