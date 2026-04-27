require "rails_helper"

RSpec.describe "Api::V1::Sops", type: :request do
  let(:workspace) { create(:workspace) }
  let(:user)      { create(:user, workspace: workspace) }
  let(:headers)   { auth_headers_for(user) }

  describe "GET /api/v1/sops" do
    it "returns the workspace SOPs" do
      sop = create(:sop, workspace: workspace, owner: user)
      _other = create(:sop) # different workspace

      get "/api/v1/sops", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.length).to eq(1)
      expect(body.first["id"]).to eq(sop.id)
      expect(body.first["status"]).to eq("draft")
    end

    it "rejects unauthenticated requests" do
      get "/api/v1/sops"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/sops/:id" do
    it "returns the SOP with steps and versions" do
      sop = create(:sop, workspace: workspace, owner: user)
      SopVersion.create!(sop: sop, version: 1, authored_by: "Vopro AI",
                         summary: "Initial", snapshot: sop.as_versioned_snapshot)

      get "/api/v1/sops/#{sop.id}", headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["id"]).to eq(sop.id)
      expect(body["versions"].length).to eq(1)
      expect(body["steps"].first["title"]).to eq("Step one")
    end

    it "404s on a SOP from a different workspace" do
      foreign = create(:sop)
      get "/api/v1/sops/#{foreign.id}", headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /api/v1/sops/:id" do
    it "updates the SOP and creates a new version" do
      sop = create(:sop, workspace: workspace, owner: user)

      patch "/api/v1/sops/#{sop.id}",
            params: { sop: { title: "New title" }, summary: "Polish" }.to_json,
            headers: headers

      expect(response).to have_http_status(:ok)
      expect(sop.reload.title).to eq("New title")
      expect(sop.sop_versions.count).to eq(1)
      expect(sop.sop_versions.last.summary).to eq("Polish")
    end
  end

  describe "GET /api/v1/sops/:id/export" do
    it "returns markdown by default" do
      sop = create(:sop, workspace: workspace, owner: user, title: "Onboard customer")
      get "/api/v1/sops/#{sop.id}/export", headers: headers
      expect(response).to have_http_status(:ok)
      expect(response.body).to include("# Onboard customer")
    end
  end
end
