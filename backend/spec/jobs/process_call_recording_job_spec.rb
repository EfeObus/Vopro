# frozen_string_literal: true

require "rails_helper"

RSpec.describe ProcessCallRecordingJob, type: :job do
  let(:workspace) { create(:workspace) }
  let(:user)      { create(:user, workspace: workspace, role: "editor") }

  before do
    FileUtils.mkdir_p(Rails.root.join("tmp"))
    File.binwrite(Rails.root.join("tmp/call_spec_audio.mp3"), "fakeaudio")
  end

  after do
    FileUtils.rm_f(Rails.root.join("tmp/call_spec_audio.mp3"))
  end

  it "transcribes, generates an SOP, and deletes the audio file" do
    rec = create(:call_recording, workspace: workspace, user: user, status: "pending")

    allow(TranscriptionService).to receive(:transcribe!).and_return("Agent promised a refund after verifying the invoice.")

    allow(AiEngineClient).to receive(:generate_from_transcript).and_return(
      "title" => "Refund verification call",
      "description" => "Support call outline.",
      "tags" => %w[support call_transcript],
      "steps" => [
        { "id" => "s1", "order" => 1, "title" => "Verify invoice", "description" => "Look up order.", "application" => nil }
      ],
      "confidence" => 0.8,
      "average_duration_sec" => 120,
      "contributors" => 1
    )

    expect {
      described_class.new.perform(rec.id)
    }.to change(Sop, :count).by(1)

    rec.reload
    expect(rec.status).to eq("completed")
    expect(rec.sop_id).to be_present
    expect(rec.transcript).to include("refund")
    expect(rec.audio_file_path).to be_blank

    sop = Sop.find(rec.sop_id)
    expect(sop.tags).to include("call_transcript")
    expect(sop.workflow_id).to be_nil
  end
end
