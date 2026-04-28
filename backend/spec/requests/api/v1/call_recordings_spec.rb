# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::CallRecordings", type: :request do
  let(:workspace) { create(:workspace) }
  let(:editor)    { create(:user, workspace: workspace, role: "editor") }
  let(:viewer)    { create(:user, workspace: workspace, role: "viewer") }
  let(:headers)   { auth_headers_for(editor) }

  # Controller rejects payloads smaller than MIN_AUDIO_BYTES (16); tests must exceed it.
  let(:valid_audio_body) { "x" * 32 }

  describe "POST /api/v1/call_recordings" do
    it "accepts mp3 upload and enqueues processing" do
      allow(ProcessCallRecordingJob).to receive(:perform_async)

      audio = Rack::Test::UploadedFile.new(StringIO.new(valid_audio_body), "audio/mpeg", original_filename: "clip.mp3")

      expect {
        post "/api/v1/call_recordings", params: { audio: audio, title_hint: "Billing call" }, headers: headers
      }.to change(CallRecording, :count).by(1)

      expect(response).to have_http_status(:accepted)
      body = JSON.parse(response.body)
      expect(body["status"]).to eq("pending")
      expect(body["titleHint"]).to eq("Billing call")
      expect(ProcessCallRecordingJob).to have_received(:perform_async).once

      rec = CallRecording.order(:created_at).last!
      expect(rec.audio_abs_path).to be_present
      FileUtils.rm_f(rec.audio_abs_path)
    end

    it "returns forbidden for viewers" do
      audio = Rack::Test::UploadedFile.new(StringIO.new("x"), "audio/mpeg", original_filename: "c.mp3")
      post "/api/v1/call_recordings",
           params: { audio: audio },
           headers: auth_headers_for(viewer)

      expect(response).to have_http_status(:forbidden)
    end

    it "returns 503 with redis_unavailable when Redis cannot be reached" do
      allow(ProcessCallRecordingJob).to receive(:perform_async).and_raise(
        RedisClient::CannotConnectError.new("Connection refused - connect(2) for 127.0.0.1:6379"),
      )

      audio = Rack::Test::UploadedFile.new(StringIO.new(valid_audio_body), "audio/mpeg", original_filename: "clip.mp3")

      post "/api/v1/call_recordings", params: { audio: audio }, headers: headers

      expect(response).to have_http_status(:service_unavailable)
      expect(JSON.parse(response.body).dig("error", "code")).to eq("redis_unavailable")
      expect(CallRecording.count).to eq(0)
    end

    it "rejects empty audio files" do
      audio = Rack::Test::UploadedFile.new(StringIO.new(""), "audio/mpeg", original_filename: "empty.mp3")

      expect {
        post "/api/v1/call_recordings", params: { audio: audio }, headers: headers
      }.not_to change(CallRecording, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(JSON.parse(response.body).dig("error", "code")).to eq("audio_empty")
    end
  end

  describe "GET /api/v1/call_recordings" do
    it "lists recordings for the workspace" do
      create(:call_recording, workspace: workspace, user: editor, status: "completed", transcript: "Hi")

      get "/api/v1/call_recordings", headers: headers

      expect(response).to have_http_status(:ok)
      rows = JSON.parse(response.body)
      expect(rows.length).to eq(1)
      expect(rows.first["status"]).to eq("completed")
      expect(rows.first["transcript"]).to eq("Hi")
      expect(rows.first["transcriptRedacted"]).to be(false)
    end

    it "redacts transcripts for viewers when another user uploaded" do
      create(:call_recording, workspace: workspace, user: editor, status: "completed", transcript: "Secret")

      get "/api/v1/call_recordings", headers: auth_headers_for(viewer)

      row = JSON.parse(response.body).first
      expect(row["transcript"]).to be_nil
      expect(row["transcriptRedacted"]).to be(true)
    end
  end
end
