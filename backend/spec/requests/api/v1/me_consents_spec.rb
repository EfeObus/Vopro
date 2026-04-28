require "rails_helper"

RSpec.describe "Api::V1::Me consents", type: :request do
  let(:user) { create(:user) }

  describe "POST /api/v1/me/consents" do
    it "records a known consent key" do
      expect do
        post "/api/v1/me/consents",
             params: { consent_key: UserConsent::KEYS.first }.to_json,
             headers: auth_headers_for(user)
      end.to change(UserConsent, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(user.reload.consented?(UserConsent::KEYS.first)).to be(true)
    end

    it "rejects unknown keys" do
      post "/api/v1/me/consents",
           params: { consent_key: "unknown_key" }.to_json,
           headers: auth_headers_for(user)

      expect(response).to have_http_status(:bad_request)
    end
  end
end
