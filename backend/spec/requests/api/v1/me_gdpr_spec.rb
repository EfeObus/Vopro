# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Me GDPR", type: :request do
  let(:workspace) { create(:workspace) }
  let(:user)      { create(:user, workspace: workspace, role: "editor") }
  let(:headers)   { auth_headers_for(user) }

  describe "GET /api/v1/me/export" do
    it "includes call recordings owned by the user" do
      create(
        :call_recording,
        workspace: workspace,
        user: user,
        status: "completed",
        transcript: "Export me",
        sop: nil
      )

      get "/api/v1/me/export", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["callRecordings"].length).to eq(1)
      expect(json["callRecordings"].first["transcript"]).to eq("Export me")
    end
  end

  describe "DELETE /api/v1/me" do
    it "removes the user's call recordings" do
      create(:call_recording, workspace: workspace, user: user, status: "completed", transcript: "gone")

      expect {
        delete "/api/v1/me", headers: headers
      }.to change(CallRecording, :count).by(-1)

      expect(response).to have_http_status(:no_content)
    end
  end
end
