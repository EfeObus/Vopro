require "rails_helper"

RSpec.describe "Api::V1::Workflows", type: :request do
  let(:workspace) { create(:workspace) }
  let(:user)      { create(:user, workspace: workspace, role: "admin") }
  let(:headers)   { auth_headers_for(user) }

  describe "GET /api/v1/workflows" do
    it "lists pending workflows" do
      pending  = create(:workflow, workspace: workspace, status: "pending")
      _other   = create(:workflow, workspace: workspace, status: "dismissed")

      get "/api/v1/workflows", params: { status: "pending" }, headers: headers

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body.map { |w| w["id"] }).to eq([pending.id])
    end
  end

  describe "POST /api/v1/workflows/:id/generate_sop" do
    it "enqueues the generation job" do
      workflow = create(:workflow, workspace: workspace)

      expect {
        post "/api/v1/workflows/#{workflow.id}/generate_sop", headers: headers
      }.to change(GenerateSopJob.jobs, :size).by(1)

      expect(response).to have_http_status(:accepted)
    end
  end

  describe "POST /api/v1/workflows/:id/dismiss" do
    it "marks the workflow as dismissed" do
      workflow = create(:workflow, workspace: workspace, status: "pending")
      post "/api/v1/workflows/#{workflow.id}/dismiss", headers: headers
      expect(response).to have_http_status(:ok)
      expect(workflow.reload.status).to eq("dismissed")
    end
  end
end
