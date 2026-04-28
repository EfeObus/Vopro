require "rails_helper"

RSpec.describe "Unified error envelope", type: :request do
  let(:workspace) { create(:workspace) }
  let(:user)      { create(:user, workspace: workspace) }

  shared_examples "a problem detail body" do |code:, status_symbol:|
    it "returns the unified error envelope" do
      body = JSON.parse(response.body)
      expect(body).to have_key("error")
      expect(body["error"]).to be_a(Hash)
      expect(body["error"]).to include(
        "code" => code,
        "status" => Rack::Utils.status_code(status_symbol),
      )
      expect(body["error"]["message"]).to be_a(String).and(be_present)
      expect(body["error"]["request_id"]).to be_a(String)
    end
  end

  describe "401 unauthorized" do
    before { get "/api/v1/sops" }

    it { expect(response).to have_http_status(:unauthorized) }
    include_examples "a problem detail body", code: "unauthorized",
                                              status_symbol: :unauthorized
  end

  describe "401 invalid credentials" do
    before do
      post "/api/v1/auth/login",
           params: { email: "ghost@example.com", password: "wrong" }.to_json,
           headers: { "Content-Type" => "application/json" }
    end

    it { expect(response).to have_http_status(:unauthorized) }
    include_examples "a problem detail body", code: "invalid_credentials",
                                              status_symbol: :unauthorized
  end

  describe "404 record not found" do
    before do
      get "/api/v1/sops/missing", headers: { "Authorization" => "Bearer #{AuthenticationService.issue_token(user)}" }
    end

    it { expect(response).to have_http_status(:not_found) }
    include_examples "a problem detail body", code: "not_found",
                                              status_symbol: :not_found
  end

  describe "400 bad request — missing required parameter" do
    before do
      post "/api/v1/auth/login",
           params: { password: "x" }.to_json,
           headers: { "Content-Type" => "application/json" }
    end

    it { expect(response).to have_http_status(:bad_request) }
    include_examples "a problem detail body", code: "bad_request",
                                              status_symbol: :bad_request
  end

  describe "403 forbidden — non-admin invite" do
    let(:viewer) { create(:user, workspace: workspace, role: "viewer") }

    before do
      post "/api/v1/invitations",
           params: { email: "x@example.com", role: "viewer" }.to_json,
           headers: {
             "Authorization" => "Bearer #{AuthenticationService.issue_token(viewer)}",
             "Content-Type" => "application/json",
           }
    end

    it { expect(response).to have_http_status(:forbidden) }
    include_examples "a problem detail body", code: "forbidden",
                                              status_symbol: :forbidden
  end

  describe "422 weak password reset" do
    before do
      token = user.password_reset_tokens.create!
      post "/api/v1/auth/password/reset",
           params: { token: token.token, password: "short" }.to_json,
           headers: { "Content-Type" => "application/json" }
    end

    it { expect(response).to have_http_status(:unprocessable_entity) }
    include_examples "a problem detail body", code: "weak_password",
                                              status_symbol: :unprocessable_entity

    it "includes details with min_length" do
      body = JSON.parse(response.body)
      expect(body["error"]["details"]).to include("min_length" => 12)
    end
  end
end
