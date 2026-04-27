module Api
  module V1
    module Integrations
      # Thin Rails-side OAuth coordinator that delegates to the
      # @vopro/integrations connector module for provider-specific URL
      # construction and code exchange.
      class OauthController < ApplicationController
        before_action :authenticate_user!
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

        def callback
          state = params.require(:state)
          code = params.require(:code)

          stash = Rails.cache.read(state_cache_key(state))
          return render(json: { error: "Invalid state" }, status: :bad_request) unless stash
          return render(json: { error: "User mismatch" }, status: :forbidden) unless stash[:user_id] == current_user.id

          credentials = connector.exchange_code(code, redirect_uri)

          integration = current_user.workspace.integrations.find_or_initialize_by(provider: @provider)
          integration.assign_attributes(
            status: "connected",
            settings: { "scopes" => credentials["scope"].to_s.split(" ") },
            secrets: credentials.to_json
          )
          integration.save!

          AuditLog.create!(
            workspace: current_user.workspace,
            user: current_user,
            action: "integration.connect",
            subject_type: "Integration",
            subject_id: integration.id,
            metadata: { provider: @provider }
          )

          Rails.cache.delete(state_cache_key(state))
          render json: IntegrationSerializer.call(integration)
        end

        private

        def load_provider
          @provider = params[:provider]
          unless SUPPORTED.include?(@provider)
            render json: { error: "Unsupported provider" }, status: :bad_request
          end
        end

        def connector
          # The @vopro/integrations module is TypeScript and runs in the agent
          # process, but for the backend we shell out to a small Node runner
          # in production. In tests we stub this.
          @connector ||= IntegrationConnectorBridge.for(@provider)
        end

        def redirect_uri
          ENV.fetch("OAUTH_REDIRECT_BASE", "http://localhost:3000") + "/api/v1/integrations/#{@provider}/callback"
        end

        def state_cache_key(state)
          "vopro:oauth:state:#{state}"
        end
      end
    end
  end
end
