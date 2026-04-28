require "sidekiq/web"

Rails.application.routes.draw do
  # Sidekiq dashboard.
  # - In test: only mounted when explicitly opted in (so CI for non-Sidekiq
  #   tests can't accidentally expose it).
  # - Everywhere else: HTTP Basic against `SIDEKIQ_WEB_USER` /
  #   `SIDEKIQ_WEB_PASSWORD`, plus an optional IP allowlist via
  #   `SIDEKIQ_WEB_ALLOWED_IPS` (comma-separated CIDRs).
  # Credentials live only in env so they never get checked into the repo.
  if Rails.env.test?
    # In test we only mount when explicitly opted in, and we skip auth so
    # request specs can drive the dashboard directly.
    mount Sidekiq::Web => "/sidekiq" if ENV["SIDEKIQ_WEB_ENABLED"] == "true"
  else
    Sidekiq::Web.use(Rack::Auth::Basic) do |user, password|
      expected_user = ENV.fetch("SIDEKIQ_WEB_USER", "")
      expected_pass = ENV.fetch("SIDEKIQ_WEB_PASSWORD", "")
      if expected_user.empty? || expected_pass.empty?
        false # Fail closed when not configured.
      else
        # Compare the concatenated `user:pass` in one shot so a timing
        # attacker can't tell which half is wrong.
        ActiveSupport::SecurityUtils.secure_compare(
          "#{user}:#{password}",
          "#{expected_user}:#{expected_pass}"
        )
      end
    end

    allowlist = ENV.fetch("SIDEKIQ_WEB_ALLOWED_IPS", "").split(",").map(&:strip).reject(&:empty?)
    if allowlist.any?
      require "ipaddr"
      ranges = allowlist.map { |cidr| IPAddr.new(cidr) }
      Sidekiq::Web.use(Class.new do
        def initialize(app, ranges)
          @app = app
          @ranges = ranges
        end

        def call(env)
          remote = env["action_dispatch.remote_ip"]&.to_s || env["REMOTE_ADDR"].to_s
          ip = IPAddr.new(remote)
          return [403, { "Content-Type" => "text/plain" }, ["Forbidden"]] unless @ranges.any? { |r| r.include?(ip) }
          @app.call(env)
        rescue IPAddr::Error
          [403, { "Content-Type" => "text/plain" }, ["Forbidden"]]
        end
      end, ranges)
    end

    mount Sidekiq::Web => "/sidekiq"
  end

  get "/health", to: "health#show"
  get "/ready",  to: "health#ready"

  namespace :api do
    namespace :v1 do
      post "events/batch", to: "events#create_batch"

      resources :workflows, only: %i[index show update] do
        member do
          post :generate_sop
          post :dismiss
        end
      end

      resources :sops do
        member do
          get :versions
          post :publish
          post :archive
          get :export
        end
      end

      resources :integrations, only: %i[index create destroy update] do
        collection do
          get  ":provider/start",    to: "integrations/oauth#start",    as: :oauth_start
          get  ":provider/callback", to: "integrations/oauth#callback", as: :oauth_callback
        end
      end

      get "analytics/overview", to: "analytics#overview"
      get "analytics/bottlenecks", to: "analytics#bottlenecks"

      post   "auth/login",   to: "auth#login"
      post   "auth/refresh", to: "auth#refresh"
      get    "auth/me",      to: "auth#me"
      delete "auth/logout",  to: "auth#logout"

      # Password reset (public, rate-limited via Rack::Attack).
      post "auth/password/forgot", to: "password_resets#create"
      post "auth/password/reset",  to: "password_resets#update"

      # Invitation acceptance (public, by token) + admin-only management.
      get  "auth/invitations/:token",        to: "invitations#show"
      post "auth/invitations/:token/accept", to: "invitations#accept"

      resources :invitations, only: %i[index create destroy]

      # GDPR
      get    "me/export", to: "me#export"
      delete "me",        to: "me#destroy"
    end
  end
end
