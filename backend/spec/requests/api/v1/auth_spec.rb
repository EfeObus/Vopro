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

    it "refuses to log in a GDPR-anonymised (soft-deleted) user" do
      user = create(:user, password: "vopro1234", email: "ghost@vopro.local")
      user.update!(deleted_at: Time.current)

      post "/api/v1/auth/login",
           params: { email: "ghost@vopro.local", password: "vopro1234" }.to_json,
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

    it "rejects a previously-valid JWT once the user has been GDPR-deleted" do
      user    = create(:user)
      headers = auth_headers_for(user)

      get "/api/v1/auth/me", headers: headers
      expect(response).to have_http_status(:ok)

      user.update!(deleted_at: Time.current)

      get "/api/v1/auth/me", headers: headers
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "DELETE /api/v1/auth/logout" do
    it "revokes the presented token so it can no longer be used" do
      user  = create(:user)
      token = AuthenticationService.issue_token(user)
      headers = { "Authorization" => "Bearer #{token}" }

      delete "/api/v1/auth/logout", headers: headers
      expect(response).to have_http_status(:no_content)

      get "/api/v1/auth/me", headers: headers
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "POST /api/v1/auth/refresh" do
    it "rotates the token and revokes the previous one" do
      user  = create(:user)
      token = AuthenticationService.issue_token(user)
      headers = { "Authorization" => "Bearer #{token}" }

      post "/api/v1/auth/refresh", headers: headers
      expect(response).to have_http_status(:ok)
      new_token = JSON.parse(response.body)["token"]
      expect(new_token).to be_a(String)
      expect(new_token).not_to eq(token)

      # Old token is now denied.
      get "/api/v1/auth/me", headers: headers
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
