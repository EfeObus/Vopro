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

    it "camelises decision-branch keys so the wire shape matches the docs and frontend types" do
      sop = create(
        :sop,
        workspace: workspace,
        owner: user,
        steps: [
          { id: "s1", order: 1, title: "Decide which path", description: "Branch on amount",
            application: "NetSuite",
            decision: {
              question: "Is invoice ≥ $25,000?",
              branches: [
                { label: "Yes", go_to_step_id: "s2", occurrences: 12 },
                { label: "No",  go_to_step_id: "s3", occurrences: 27 }
              ]
            } },
          { id: "s2", order: 2, title: "Route to Director", description: "Tag in Slack",
            application: "Slack" }
        ]
      )

      get "/api/v1/sops/#{sop.id}", headers: headers

      expect(response).to have_http_status(:ok)
      branches = JSON.parse(response.body).dig("steps", 0, "decision", "branches")
      expect(branches).to all(have_key("goToStepId"))
      expect(branches).to all(have_key("label"))
      expect(branches.first["goToStepId"]).to eq("s2")
      # Snake-case keys must not leak through.
      expect(branches.first.keys).not_to include("go_to_step_id")
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
      expect(response.headers["Cache-Control"]).to include("private")
    end

    it "returns a valid PDF when format=pdf" do
      sop = create(:sop, workspace: workspace, owner: user, title: "PDF Export Test")
      get "/api/v1/sops/#{sop.id}/export", params: { format: "pdf" }, headers: headers
      expect(response).to have_http_status(:ok)
      expect(response.body).to start_with("%PDF")
      expect(response.headers["Content-Type"]).to include("application/pdf")
      expect(response.headers["Content-Disposition"]).to match(/pdf-export-test\.pdf/)
    end

    it "rejects unknown export formats" do
      sop = create(:sop, workspace: workspace, owner: user)
      get "/api/v1/sops/#{sop.id}/export", params: { format: "exe" }, headers: headers
      expect(response).to have_http_status(:bad_request)
      json = JSON.parse(response.body)
      expect(json.dig("error", "code")).to eq("invalid_parameter")
    end
  end

  describe "POST /api/v1/sops/:id/publish" do
    it "transitions a draft SOP to published and returns the new status" do
      sop = create(:sop, workspace: workspace, owner: user, status: "draft")

      post "/api/v1/sops/#{sop.id}/publish", headers: headers

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq("status" => "published")
      expect(sop.reload.status).to eq("published")
    end

    it "is idempotent — publishing an already-published SOP stays published" do
      sop = create(:sop, workspace: workspace, owner: user, status: "published")

      post "/api/v1/sops/#{sop.id}/publish", headers: headers

      expect(response).to have_http_status(:ok)
      expect(sop.reload.status).to eq("published")
    end

    it "404s on a SOP from a different workspace" do
      foreign = create(:sop)
      post "/api/v1/sops/#{foreign.id}/publish", headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/sops/:id/archive" do
    it "transitions any SOP to archived" do
      sop = create(:sop, workspace: workspace, owner: user, status: "published")

      post "/api/v1/sops/#{sop.id}/archive", headers: headers

      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)).to eq("status" => "archived")
      expect(sop.reload.status).to eq("archived")
    end

    it "writes an audit log entry" do
      sop = create(:sop, workspace: workspace, owner: user)

      expect {
        post "/api/v1/sops/#{sop.id}/archive", headers: headers
      }.to change { AuditLog.where(action: "sop.archive", subject_id: sop.id).count }.by(1)
    end
  end
end
