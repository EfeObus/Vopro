require "rails_helper"

RSpec.describe "Api::V1::Integrations::OAuth", type: :request do
  let(:workspace) { create(:workspace) }
  let(:user)      { create(:user, workspace: workspace) }
  let(:headers)   { auth_headers_for(user) }

  describe "GET /api/v1/integrations/:provider/start" do
    it "returns an authorize URL with a state parameter" do
      get "/api/v1/integrations/google/start", headers: headers

      expect(response).to have_http_status(:ok)
      url = JSON.parse(response.body)["url"]
      expect(url).to start_with("https://accounts.google.com/")
      expect(url).to include("state=")
      expect(url).to include("scope=")
    end

    it "rejects unknown providers" do
      get "/api/v1/integrations/zoom/start", headers: headers
      expect(response).to have_http_status(:bad_request)
    end
  end

  describe "GET /api/v1/integrations/:provider/callback" do
    it "rejects unknown state values" do
      get "/api/v1/integrations/google/callback",
          params: { code: "abc", state: "wrong" },
          headers: headers
      expect(response).to have_http_status(:bad_request)
    end

    it "creates the Integration record on a valid callback" do
      # Prime the cache with a known state
      state = "valid-state"
      Rails.cache.write("vopro:oauth:state:#{state}",
                        { user_id: user.id, workspace_id: workspace.id, provider: "google" },
                        expires_in: 5.minutes)

      stub = instance_double(IntegrationConnectorBridge::GoogleConnector,
                             exchange_code: { "access_token" => "tok", "scope" => "drive calendar" })
      allow(IntegrationConnectorBridge).to receive(:for).with("google").and_return(stub)

      get "/api/v1/integrations/google/callback",
          params: { code: "auth-code", state: state },
          headers: headers

      expect(response).to have_http_status(:ok)
      integration = workspace.integrations.find_by(provider: "google")
      expect(integration).to be_present
      expect(integration.status).to eq("connected")
    end
  end
end
