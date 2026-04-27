# Bridge between the Rails OAuth controller and the @vopro/integrations
# Node module. We keep the OAuth surface in TypeScript (single source of
# truth, also used by the agent) and call into it via thin server-side
# helpers here.
#
# In production this can shell out to a small Node runner; for the MVP we
# duplicate the URL/exchange logic in Ruby for the providers we ship by
# default. The interface lets us swap to the Node bridge later without
# touching call sites.

class IntegrationConnectorBridge
  def self.for(provider)
    case provider
    when "google"    then GoogleConnector.new
    when "microsoft" then MicrosoftConnector.new
    else
      raise ArgumentError, "Unknown provider: #{provider}"
    end
  end

  class GoogleConnector
    SCOPES = [
      "https://www.googleapis.com/auth/drive.metadata.readonly",
      "https://www.googleapis.com/auth/calendar.readonly"
    ].freeze

    def authorize_url(redirect_uri, state)
      params = {
        client_id: ENV["GOOGLE_CLIENT_ID"].to_s,
        redirect_uri: redirect_uri,
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        scope: SCOPES.join(" "),
        state: state
      }
      "https://accounts.google.com/o/oauth2/v2/auth?#{params.to_query}"
    end

    def exchange_code(code, redirect_uri)
      response = HTTParty.post(
        "https://oauth2.googleapis.com/token",
        body: {
          code: code,
          client_id: ENV["GOOGLE_CLIENT_ID"],
          client_secret: ENV["GOOGLE_CLIENT_SECRET"],
          redirect_uri: redirect_uri,
          grant_type: "authorization_code"
        },
        headers: { "Content-Type" => "application/x-www-form-urlencoded" }
      )
      raise "Google token exchange failed: #{response.code}" unless response.success?

      response.parsed_response
    end
  end

  class MicrosoftConnector
    SCOPES = %w[offline_access Files.Read Calendars.Read Mail.Read].freeze

    def authorize_url(redirect_uri, state)
      params = {
        client_id: ENV["MICROSOFT_CLIENT_ID"].to_s,
        redirect_uri: redirect_uri,
        response_type: "code",
        response_mode: "query",
        scope: SCOPES.join(" "),
        state: state
      }
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?#{params.to_query}"
    end

    def exchange_code(code, redirect_uri)
      response = HTTParty.post(
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        body: {
          client_id: ENV["MICROSOFT_CLIENT_ID"],
          client_secret: ENV["MICROSOFT_CLIENT_SECRET"],
          code: code,
          redirect_uri: redirect_uri,
          grant_type: "authorization_code",
          scope: SCOPES.join(" ")
        },
        headers: { "Content-Type" => "application/x-www-form-urlencoded" }
      )
      raise "Microsoft token exchange failed: #{response.code}" unless response.success?

      response.parsed_response
    end
  end
end
