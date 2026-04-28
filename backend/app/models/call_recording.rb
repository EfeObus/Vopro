# frozen_string_literal: true

# Voice call (or meeting) audio uploaded by a workspace user; transcribed via
# OpenAI Whisper, then structured into an Sop by the ai-engine.
class CallRecording < ApplicationRecord
  STATUSES = %w[pending transcribing generating_sop completed failed].freeze

  belongs_to :workspace
  belongs_to :user
  belongs_to :sop, optional: true

  validates :status, inclusion: { in: STATUSES }

  before_destroy :unlink_audio_file

  # Relative to Rails.root — set after multipart save in the controller.
  def audio_abs_path
    return if audio_file_path.blank?

    Rails.root.join(audio_file_path)
  end

  def purge_audio_file!
    path = audio_abs_path
    File.delete(path) if path && File.file?(path)
    update_columns(audio_file_path: nil, audio_content_type: nil, audio_byte_size: nil)
  end

  def unlink_audio_file
    path = audio_abs_path
    File.delete(path) if path && File.file?(path)
  rescue StandardError => e
    Rails.logger.warn("[CallRecording] unlink_audio_file #{id}: #{e.class}: #{e.message}")
  end
end
