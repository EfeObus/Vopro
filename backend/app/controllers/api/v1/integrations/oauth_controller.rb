module Api
  module V1
    module Integrations
      # Thin Rails-side OAuth coordinator that delegates to the
      # @vopro/integrations connector module for provider-specific URL
      # construction and code exchange.
      class OauthController < ApplicationController
        before_action :authenticate_user!, only: :start
        before_action :load_provider

        SUPPORTED = %w[google microsoft].freeze

        def start
          state = SecureRandom.urlsafe_base64(24)
          Rails.cache.write(state_cache_key(state), {
            user_id: current_user.id,
            workspace_id: current_user.workspace_id,
            provider: @provider
          }, expires_in: 10.minutes)

          render json: { url: connector.authorize_url(redirect_uri, state) }
        end

        # The callback runs in the user's browser as a redirect from the OAuth
        # provider. There is no Authorization header — we authenticate via the
        # `state` value we cached in `start` (signed at the user level).
        def callback
          state = params[:state].to_s
          code  = params[:code].to_s

          if state.empty? || code.empty?
            return render_callback_html(success: false, message: "Missing code or state.")
          end

          stash = Rails.cache.read(state_cache_key(state))
          unless stash
            return render_callback_html(success: false, message: "Authorization expired. Please retry.")
          end

          user = User.find_by(id: stash[:user_id])
          workspace = Workspace.find_by(id: stash[:workspace_id])
          unless user && workspace
            return render_callback_html(success: false, message: "Session no longer valid.")
          end

          begin
            credentials = connector.exchange_code(code, redirect_uri)
          rescue => e
            Rails.logger.error("[oauth] #{@provider} code exchange failed: #{e.class}: #{e.message}")
            return render_callback_html(success: false, message: "Could not finish authorization.")
          end

          integration = workspace.integrations.find_or_initialize_by(provider: @provider)
          integration.assign_attributes(
            status: "connected",
            settings: { "scopes" => credentials["scope"].to_s.split(" ") },
            secrets: credentials.to_json
          )
          integration.save!

          AuditLog.create!(
            workspace: workspace,
            user: user,
            action: "integration.connect",
            subject_type: "Integration",
            subject_id: integration.id,
            metadata: { provider: @provider }
          )

          Rails.cache.delete(state_cache_key(state))

          if json_callback_requested?
            render json: IntegrationSerializer.call(integration)
          else
            render_callback_html(success: true, message: "Connected to #{@provider.titleize}.")
          end
        end

        private

        def load_provider
          @provider = params[:provider]
          return if SUPPORTED.include?(@provider)

          # `start` is a JSON API endpoint hit from the dashboard — it should
          # 400 on a bad provider. `callback` is a browser redirect from the
          # provider, so we surface the error in the close-window page.
          if action_name == "start" || json_callback_requested?
            render_error(
              status: :bad_request,
              code: "unsupported_provider",
              message: "Unsupported integration provider",
              details: { supported: SUPPORTED }
            )
          else
            render_callback_html(success: false, message: "Unsupported provider.")
          end
        end

        def connector
          @connector ||= IntegrationConnectorBridge.for(@provider)
        end

        def redirect_uri
          ENV.fetch("OAUTH_REDIRECT_BASE", "http://localhost:3000") + "/api/v1/integrations/#{@provider}/callback"
        end

        def state_cache_key(state)
          "vopro:oauth:state:#{state}"
        end

        # Tests still want the JSON shape; we honour `Accept: application/json`
        # but everything else (i.e. real browser redirects) gets HTML.
        def json_callback_requested?
          request.format.json? || request.headers["Accept"].to_s.include?("application/json")
        end

        def render_callback_html(success:, message:)
          html = oauth_callback_html(success: success, message: message)
          render html: html.html_safe, status: success ? :ok : :ok, content_type: "text/html"
        end

        def oauth_callback_html(success:, message:)
          tone = success ? "#16a34a" : "#dc2626"
          payload = {
            type: "vopro:integration-callback",
            ok: success,
            provider: @provider,
            message: message
          }.to_json
          # Lock postMessage to a known frontend origin in production. We accept
          # a comma-separated list (`FRONTEND_ORIGIN`) so multi-tenant deploys
          # can list their dashboard hosts. Falls back to "*" only when the env
          # is unset (dev), since the opener origin can't otherwise be inferred.
          target_origins_json = ENV.fetch("FRONTEND_ORIGIN", "").split(",").map(&:strip).reject(&:empty?).to_json
          target_origins_json = "[]" if target_origins_json == "null"
          <<~HTML
            <!doctype html>
            <html lang="en">
              <head>
                <meta charset="utf-8" />
                <title>Vopro \xC2\xB7 OAuth</title>
                <style>
                  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
                         margin: 0; min-height: 100vh; display: grid; place-items: center;
                         background: #f7f8fb; color: #1f2333; }
                  .card { width: 360px; padding: 32px 28px; background: #fff;
                          border: 1px solid #e6e8ee; border-radius: 14px; }
                  h1 { font-size: 16px; margin: 0 0 8px; color: #{tone}; }
                  p  { font-size: 13px; line-height: 1.5; color: #4a5163; margin: 0 0 18px; }
                  button { font-size: 12px; font-weight: 600; padding: 8px 12px;
                           border-radius: 8px; border: 1px solid #d8dce6; background: #fff; cursor: pointer; }
                </style>
              </head>
              <body>
                <div class="card">
                  <h1>#{success ? "Connection complete" : "Couldn\xE2\x80\x99t finish"}</h1>
                  <p>#{ERB::Util.html_escape(message)}</p>
                  <button id="close">Close window</button>
                </div>
                <script>
                  (function () {
                    var payload = #{payload};
                    var allowed = #{target_origins_json};
                    try {
                      if (window.opener && !window.opener.closed) {
                        if (allowed.length === 0) {
                          // Dev fallback only — production should configure FRONTEND_ORIGIN.
                          window.opener.postMessage(payload, "*");
                        } else {
                          allowed.forEach(function (origin) {
                            try { window.opener.postMessage(payload, origin); } catch (e) {}
                          });
                        }
                      }
                    } catch (e) {}
                    document.getElementById("close").addEventListener("click", function () { window.close(); });
                    setTimeout(function () { try { window.close(); } catch (e) {} }, 2500);
                  })();
                </script>
              </body>
            </html>
          HTML
        end
      end
    end
  end
end
