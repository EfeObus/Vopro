require "rails_helper"

RSpec.describe "Api::V1::Invitations", type: :request do
  let(:workspace) { create(:workspace) }
  let(:admin)     { create(:user, workspace: workspace, role: "admin") }
  let(:viewer)    { create(:user, workspace: workspace, role: "viewer") }

  describe "POST /api/v1/invitations" do
    it "creates an invitation when the caller is an admin" do
      post "/api/v1/invitations",
           params: { email: "newbie@example.com", role: "editor" }.to_json,
           headers: auth_headers_for(admin).merge("Content-Type" => "application/json")

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["email"]).to eq("newbie@example.com")
      expect(body["role"]).to eq("editor")
      expect(body["token"]).to be_a(String)
    end

    it "rejects non-admins" do
      post "/api/v1/invitations",
           params: { email: "newbie@example.com" }.to_json,
           headers: auth_headers_for(viewer).merge("Content-Type" => "application/json")
      expect(response).to have_http_status(:forbidden)
    end

    it "409s when the email is already a user" do
      create(:user, workspace: workspace, email: "taken@example.com")
      post "/api/v1/invitations",
           params: { email: "taken@example.com" }.to_json,
           headers: auth_headers_for(admin).merge("Content-Type" => "application/json")
      expect(response).to have_http_status(:conflict)
    end

    context "when the workspace has a claimed domain" do
      let(:workspace) { create(:workspace, claimed_domain: "acme.com") }
      let(:admin) { create(:user, workspace: workspace, role: "admin") }

      it "creates an invitation when the email matches the domain" do
        post "/api/v1/invitations",
             params: { email: "peer@acme.com", role: "viewer" }.to_json,
             headers: auth_headers_for(admin).merge("Content-Type" => "application/json")

        expect(response).to have_http_status(:created)
      end

      it "422s when the email domain does not match" do
        post "/api/v1/invitations",
             params: { email: "outsider@gmail.com", role: "viewer" }.to_json,
             headers: auth_headers_for(admin).merge("Content-Type" => "application/json")

        expect(response).to have_http_status(:unprocessable_entity)
        body = JSON.parse(response.body)
        expect(body.dig("error", "code")).to eq("domain_mismatch")
      end
    end
  end

  describe "GET /api/v1/auth/invitations/:token" do
    it "returns metadata for a usable invitation" do
      inv = create(:invitation, workspace: workspace, inviter: admin, email: "x@y.io")
      get "/api/v1/auth/invitations/#{inv.token}"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["email"]).to eq("x@y.io")
    end

    it "returns 410 when the invitation is expired" do
      inv = create(:invitation, workspace: workspace, inviter: admin,
                                expires_at: 1.day.ago)
      get "/api/v1/auth/invitations/#{inv.token}"
      expect(response).to have_http_status(:gone)
    end
  end

  describe "POST /api/v1/auth/invitations/:token/accept" do
    it "creates a user and returns a JWT" do
      inv = create(:invitation, workspace: workspace, inviter: admin,
                                email: "newbie@example.com", role: "editor")

      post "/api/v1/auth/invitations/#{inv.token}/accept",
           params: { name: "New Hire", password: "correct horse battery" }.to_json,
           headers: { "Content-Type" => "application/json" }

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["token"]).to be_a(String)
      expect(body.dig("user", "email")).to eq("newbie@example.com")
      expect(inv.reload.accepted_at).to be_present
    end

    it "rejects passwords that are too short" do
      inv = create(:invitation, workspace: workspace, inviter: admin)
      post "/api/v1/auth/invitations/#{inv.token}/accept",
           params: { name: "x", password: "short" }.to_json,
           headers: { "Content-Type" => "application/json" }
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
