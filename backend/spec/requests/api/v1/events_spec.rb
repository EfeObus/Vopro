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
      expect(body["rejected"]).to eq(0)
    end

    it "rejects when device_id is missing" do
      post "/api/v1/events/batch", params: { events: [] }.to_json, headers: headers
      expect(response).to have_http_status(:bad_request)
    end

    it "drops events with invalid kinds and reports them as rejected" do
      payload = {
        device_id: SecureRandom.uuid,
        events: [
          { kind: "click", application: "X", occurred_at: Time.current.iso8601 },
          { kind: "doom",  application: "X", occurred_at: Time.current.iso8601 },
          { kind: "navigation", application: "X", occurred_at: "yesterday" }
        ]
      }
      post "/api/v1/events/batch", params: payload.to_json, headers: headers
      expect(response).to have_http_status(:accepted)
      body = JSON.parse(response.body)
      expect(body["accepted"]).to eq(1)
      expect(body["rejected"]).to eq(2)
    end

    it "rejects batches that exceed the maximum size" do
      events = Array.new(501) do
        { kind: "click", application: "X", occurred_at: Time.current.iso8601 }
      end
      post "/api/v1/events/batch",
           params: { device_id: "d-1", events: events }.to_json,
           headers: headers
      expect(response).to have_http_status(:payload_too_large)
    end

    it "422s when no events survive validation" do
      payload = {
        device_id: "d-1",
        events: [{ kind: "doom", occurred_at: Time.current.iso8601 }]
      }
      post "/api/v1/events/batch", params: payload.to_json, headers: headers
      expect(response).to have_http_status(:unprocessable_entity)
      body = JSON.parse(response.body)
      expect(body["error"]["code"]).to eq("no_valid_events")
      expect(body["error"]["details"]["accepted"]).to eq(0)
      expect(body["error"]["details"]["rejected"]).to eq(1)
    end
  end
end
