require "rails_helper"

RSpec.describe "Api::V1::Events", type: :request do
  let(:workspace) { create(:workspace) }
  let(:user)      { create(:user, workspace: workspace) }
  let(:headers)   { auth_headers_for(user) }

  describe "POST /api/v1/events/batch" do
    it "enqueues an ingestion job and 202s" do
      payload = {
        device_id: SecureRandom.uuid,
        events: [
          { kind: "click", application: "Salesforce", target: "Convert", occurred_at: Time.current.iso8601 },
          { kind: "form_submit", application: "Salesforce", target: "Save", occurred_at: Time.current.iso8601 }
        ]
      }

      expect {
        post "/api/v1/events/batch", params: payload.to_json, headers: headers
      }.to change(IngestEventBatchJob.jobs, :size).by(1)

      expect(response).to have_http_status(:accepted)
      body = JSON.parse(response.body)
      expect(body["accepted"]).to eq(2)
    end

    it "rejects when device_id is missing" do
      post "/api/v1/events/batch", params: { events: [] }.to_json, headers: headers
      expect(response).to have_http_status(:bad_request)
    end
  end
end
