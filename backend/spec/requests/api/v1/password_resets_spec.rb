require "rails_helper"

RSpec.describe "Api::V1::PasswordResets", type: :request do
  describe "POST /api/v1/auth/password/forgot" do
    it "responds 202 even when the email is unknown (no enumeration)" do
      post "/api/v1/auth/password/forgot",
           params: { email: "ghost@example.com" }.to_json,
           headers: { "Content-Type" => "application/json" }
      expect(response).to have_http_status(:accepted)
    end

    it "creates a reset token for an existing user" do
      user = create(:user, email: "hi@vopro.local")

      expect {
        post "/api/v1/auth/password/forgot",
             params: { email: "hi@vopro.local" }.to_json,
             headers: { "Content-Type" => "application/json" }
      }.to change { user.password_reset_tokens.count }.by(1)

      expect(response).to have_http_status(:accepted)
    end
  end

  describe "POST /api/v1/auth/password/reset" do
    let(:user)  { create(:user, password: "vopro1234") }
    let(:token) { user.password_reset_tokens.create! }

    it "rotates the password when the token is valid" do
      post "/api/v1/auth/password/reset",
           params: { token: token.token, password: "new-strong-passphrase" }.to_json,
           headers: { "Content-Type" => "application/json" }

      expect(response).to have_http_status(:no_content)
      expect(user.reload.authenticate("new-strong-passphrase")).to be_truthy
      expect(token.reload.consumed_at).to be_present
    end

    it "rejects expired tokens" do
      token.update_columns(expires_at: 1.minute.ago)
      post "/api/v1/auth/password/reset",
           params: { token: token.token, password: "new-strong-passphrase" }.to_json,
           headers: { "Content-Type" => "application/json" }
      expect(response).to have_http_status(:gone)
    end

    it "rejects passwords that are too short" do
      post "/api/v1/auth/password/reset",
           params: { token: token.token, password: "short" }.to_json,
           headers: { "Content-Type" => "application/json" }
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
