require "rails_helper"

RSpec.describe "Api::V1::Auth", type: :request do
  describe "POST /api/v1/auth/login" do
    it "returns a JWT for valid credentials" do
      user = create(:user, password: "vopro1234", email: "demo@vopro.local")

      post "/api/v1/auth/login",
           params: { email: "demo@vopro.local", password: "vopro1234" }.to_json,
           headers: { "Content-Type" => "application/json" }

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["token"]).to be_a(String)
      expect(body.dig("user", "email")).to eq(user.email)
    end

    it "rejects bad passwords" do
      create(:user, password: "vopro1234", email: "demo@vopro.local")
      post "/api/v1/auth/login",
           params: { email: "demo@vopro.local", password: "wrong" }.to_json,
           headers: { "Content-Type" => "application/json" }
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/auth/me" do
    it "returns the current user" do
      user = create(:user)
      get "/api/v1/auth/me", headers: auth_headers_for(user)
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["id"]).to eq(user.id)
    end

    it "rejects when no token is present" do
      get "/api/v1/auth/me"
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
