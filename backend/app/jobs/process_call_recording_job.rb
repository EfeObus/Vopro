# frozen_string_literal: true

class ProcessCallRecordingJob
  include Sidekiq::Job
  # One attempt — Whisper/transcription failures are usually deterministic; user can re-upload.
  sidekiq_options queue: :default, retry: false

  def perform(call_recording_id)
    rec = CallRecording.find_by(id: call_recording_id)
    return unless rec
    return unless rec.status == "pending"

    path = rec.audio_abs_path
    unless path&.file?
      rec.update!(status: "failed", error_message: "Audio file is missing.")
      return
    end

    rec.update!(status: "transcribing", error_message: nil)

    transcript = TranscriptionService.transcribe!(
      path: path.to_s,
      filename: File.basename(path.to_s),
      content_type: rec.audio_content_type
    )

    rec.update!(transcript: transcript, status: "generating_sop")

    result = AiEngineClient.generate_from_transcript(
      transcript: transcript,
      title_hint: rec.title_hint
    )

    workspace = rec.workspace
    user = rec.user

    tags = (Array(result["tags"]).compact.map(&:to_s) + ["call_transcript"]).uniq

    sop = workspace.sops.build(
      owner: user,
      workflow_id: nil,
      title: result["title"].presence || rec.title_hint.presence || "Call transcript procedure",
      description: result["description"].to_s,
      status: "draft",
      tags: tags,
      steps: CallRecordingSopSteps.normalize(result["steps"]),
      confidence: result["confidence"].to_f,
      runs_observed: 1,
      contributors: result["contributors"].to_i.positive? ? result["contributors"].to_i : 1,
      average_duration_sec: result["average_duration_sec"].to_i
    )

    ActiveRecord::Base.transaction do
      sop.save!
      SopVersion.create!(
        sop: sop,
        version: sop.next_version_number,
        authored_by: "Vopro AI",
        summary: "Generated from call transcription.",
        snapshot: sop.as_versioned_snapshot
      )
      rec.update!(status: "completed", sop_id: sop.id)
    end

    rec.reload.purge_audio_file!
  rescue TranscriptionService::Error, AiEngineClient::Error => e
    Rails.logger.warn("[call-recording] #{call_recording_id}: #{e.class}: #{e.message}")
    rec&.update!(status: "failed", error_message: e.message)
    rec&.purge_audio_file!
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.warn("[call-recording] #{call_recording_id}: validation #{e.record.errors.full_messages.join(', ')}")
    msg = e.record.errors.full_messages.join(", ").presence || e.message
    rec&.update!(status: "failed", error_message: "Could not save SOP: #{msg}")
    rec&.purge_audio_file!
  rescue StandardError => e
    Rails.logger.error("[call-recording] #{call_recording_id}: #{e.class}: #{e.message}\n#{e.backtrace&.first(8)&.join("\n")}")
    rec&.update!(status: "failed", error_message: "Processing failed — try again or contact support.") if rec
    rec&.purge_audio_file!
    raise e if Rails.env.development?
  end
end
