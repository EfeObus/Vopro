require "rails_helper"

RSpec.describe "Api::V1::Signups", type: :request do
  describe "POST /api/v1/signup" do
    it "creates a workspace, admin user, and returns a JWT" do
      expect do
        post "/api/v1/signup",
             params: {
               signup: {
                 workspace_name: "Acme Corp",
                 claimed_domain: "acme.com",
                 admin_email: "admin@acme.com",
                 admin_password: "twelvecharszz",
                 admin_name: "Alex Admin"
               }
             }.to_json,
             headers: { "Content-Type" => "application/json" }
      end.to change(Workspace, :count).by(1).and change(User, :count).by(1)

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["token"]).to be_a(String)
      expect(body.dig("user", "email")).to eq("admin@acme.com")
      expect(body.dig("user", "role")).to eq("admin")
      expect(body.dig("workspace", "claimedDomain")).to eq("acme.com")
    end

    it "rejects consumer (personal) email domains outside development" do
      post "/api/v1/signup",
           params: {
             signup: {
               workspace_name: "Solo",
               claimed_domain: "gmail.com",
               admin_email: "someone@gmail.com",
               admin_password: "twelvecharszz",
               admin_name: "Sam"
             }
           }.to_json,
           headers: { "Content-Type" => "application/json" }

      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body.dig("error", "code")).to eq("personal_email_not_allowed")
    end

    it "rejects when admin email domain does not match claimed domain" do
      post "/api/v1/signup",
           params: {
             signup: {
               workspace_name: "Acme Corp",
               claimed_domain: "acme.com",
               admin_email: "person@other.com",
               admin_password: "twelvecharszz",
               admin_name: "Alex Admin"
             }
           }.to_json,
           headers: { "Content-Type" => "application/json" }

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "rejects weak passwords" do
      post "/api/v1/signup",
           params: {
             signup: {
               workspace_name: "Acme Corp",
               claimed_domain: "acme.com",
               admin_email: "admin@acme.com",
               admin_password: "short",
               admin_name: "Alex Admin"
             }
           }.to_json,
           headers: { "Content-Type" => "application/json" }

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "POST /api/v1/signup/verify_email" do
    it "marks the workspace verified when the token is valid" do
      post "/api/v1/signup",
           params: {
             signup: {
               workspace_name: "Beta LLC",
               claimed_domain: "beta.io",
               admin_email: "owner@beta.io",
               admin_password: "twelvecharszz",
               admin_name: "Bob"
             }
           }.to_json,
           headers: { "Content-Type" => "application/json" }

      raw = SignupEmailToken.last.token

      post "/api/v1/signup/verify_email",
           params: { token: raw }.to_json,
           headers: { "Content-Type" => "application/json" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["ok"]).to be(true)
      expect(SignupEmailToken.last.consumed_at).to be_present
      expect(Workspace.find(body["workspaceId"]).domain_verified_at).to be_present
    end

    it "returns gone for unknown tokens" do
      post "/api/v1/signup/verify_email",
           params: { token: "invalid" }.to_json,
           headers: { "Content-Type" => "application/json" }

      expect(response).to have_http_status(:gone)
    end
  end
end
