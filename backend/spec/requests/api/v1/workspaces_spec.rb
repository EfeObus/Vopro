require "rails_helper"

RSpec.describe "Api::V1::Workspace", type: :request do
  let(:workspace) { create(:workspace, settings: { "auto_generate_sop" => false }) }
  let(:headers)   { auth_headers_for(user) }

  describe "GET /api/v1/workspace" do
    let(:user) { create(:user, workspace: workspace, role: "editor") }

    it "returns merged workspace settings" do
      get "/api/v1/workspace", headers: headers
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["id"]).to eq(workspace.id)
      expect(body["settings"]["auto_generate_sop"]).to eq(false)
      expect(body["settings"]["event_retention_days"]).to eq(30)
      expect(body["settings"]["masking_rules"].length).to eq(6)
    end
  end

  describe "PATCH /api/v1/workspace" do
    let(:admin) { create(:user, workspace: workspace, role: "admin") }
    let(:headers_admin) { auth_headers_for(admin) }

    it "updates workspace settings for an admin" do
      patch "/api/v1/workspace",
            params: {
              workspace: {
                settings: {
                  auto_generate_sop: true,
                  event_retention_days: 45
                }
              }
            },
            headers: headers_admin,
            as: :json

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["settings"]["auto_generate_sop"]).to eq(true)
      expect(body["settings"]["event_retention_days"]).to eq(45)
      expect(workspace.reload.settings["auto_generate_sop"]).to eq(true)
    end

    it "403s for a non-admin" do
      editor = create(:user, workspace: workspace, role: "editor")
      patch "/api/v1/workspace",
            params: { workspace: { settings: { auto_generate_sop: true } } },
            headers: auth_headers_for(editor),
            as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end
end
