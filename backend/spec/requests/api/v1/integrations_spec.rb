require "rails_helper"

RSpec.describe "Api::V1::Integrations", type: :request do
  let(:workspace) { create(:workspace) }
  let(:user)      { create(:user, workspace: workspace, role: "admin") }
  let(:headers)   { auth_headers_for(user) }

  describe "GET /api/v1/integrations" do
    it "lists integrations scoped to the caller's workspace" do
      mine    = create(:integration, workspace: workspace, provider: "google", status: "connected")
      _other  = create(:integration, provider: "google") # different workspace

      get "/api/v1/integrations", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.length).to eq(1)
      expect(body.first["id"]).to eq(mine.id)
      expect(body.first).to include("provider" => "google", "status" => "connected")
    end

    it "rejects unauthenticated requests" do
      get "/api/v1/integrations"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "POST /api/v1/integrations" do
    it "upserts REST so a second POST updates the same row" do
      post "/api/v1/integrations",
           params: {
             integration: {
               provider: "rest",
               status: "connected",
               settings: { endpoint: "https://example.com/a" },
               secrets: { api_key: "one" }
             }
           },
           headers: headers,
           as: :json

      expect(response).to have_http_status(:created)

      post "/api/v1/integrations",
           params: {
             integration: {
               provider: "rest",
               status: "connected",
               settings: { endpoint: "https://example.com/b" },
               secrets: { api_key: "two" }
             }
           },
           headers: headers,
           as: :json

      expect(response).to have_http_status(:ok)
      expect(Integration.where(workspace: workspace, provider: "rest").count).to eq(1)
      expect(Integration.find_by(workspace: workspace, provider: "rest").settings["endpoint"]).to eq("https://example.com/b")
    end

    it "returns 409 when a non-REST integration already exists" do
      create(:integration, workspace: workspace, provider: "zendesk", status: "connected")

      post "/api/v1/integrations",
           params: {
             integration: {
               provider: "zendesk",
               status: "connected",
               settings: {},
               secrets: {}
             }
           },
           headers: headers,
           as: :json

      expect(response).to have_http_status(:conflict)
      expect(JSON.parse(response.body).dig("error", "code")).to eq("integration_exists")
    end
  end

  describe "DELETE /api/v1/integrations/:id" do
    it "destroys the integration and writes an audit log entry" do
      integration = create(:integration, workspace: workspace, provider: "slack", status: "connected")

      expect {
        delete "/api/v1/integrations/#{integration.id}", headers: headers
      }.to change(Integration, :count).by(-1)
        .and change { AuditLog.where(action: "integration.disconnect").count }.by(1)

      expect(response).to have_http_status(:no_content)
    end

    it "404s on an integration from another workspace" do
      foreign = create(:integration, provider: "google")
      delete "/api/v1/integrations/#{foreign.id}", headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end
end
