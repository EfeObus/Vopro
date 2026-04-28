require "rails_helper"

RSpec.describe "Api::V1::Organizations", type: :request do
  let(:workspace) { create(:workspace, claimed_domain: "acme.com") }
  let(:admin) { create(:user, workspace: workspace, role: "admin") }
  let(:viewer) { create(:user, workspace: workspace, role: "viewer") }

  describe "GET /api/v1/organization" do
    it "returns a snapshot for admins" do
      get "/api/v1/organization", headers: auth_headers_for(admin)
      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["claimedDomain"]).to eq("acme.com")
      expect(body).to have_key("billingPlan")
    end

    it "returns forbidden for non-admins" do
      get "/api/v1/organization", headers: auth_headers_for(viewer)
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "POST /api/v1/organization/domain_dns/start" do
    it "issues a TXT token" do
      post "/api/v1/organization/domain_dns/start",
           headers: auth_headers_for(admin)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["dnsTxtHost"]).to include("acme.com")
      expect(body["dnsTxtValue"]).to include("vopro-verify=")
      expect(workspace.reload.dns_verification_token).to be_present
    end
  end

  describe "POST /api/v1/organization/domain_dns/verify" do
    it "verifies when DNS contains the token" do
      workspace.update!(dns_verification_token: "vopro-verify=deadbeef")
      allow(DnsVerifier).to receive(:txt_records_include?).with("acme.com", "vopro-verify=deadbeef").and_return(true)

      post "/api/v1/organization/domain_dns/verify",
           headers: auth_headers_for(admin)

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["domainVerified"]).to be(true)
      expect(workspace.reload.domain_verified_at).to be_present
    end

    it "returns unprocessable when DNS is missing" do
      workspace.update!(dns_verification_token: "vopro-verify=deadbeef")
      allow(DnsVerifier).to receive(:txt_records_include?).and_return(false)

      post "/api/v1/organization/domain_dns/verify",
           headers: auth_headers_for(admin)

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
