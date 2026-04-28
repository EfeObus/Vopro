# frozen_string_literal: true

class CallRecordingSerializer
  def self.call(recording, context_user:)
    show_transcript = transcript_visible?(recording, context_user)

    {
      id: recording.id,
      status: recording.status,
      titleHint: recording.title_hint,
      transcript: show_transcript ? recording.transcript : nil,
      transcriptRedacted: !show_transcript && recording.transcript.present?,
      errorMessage: recording.error_message,
      sopId: recording.sop_id,
      metadata: recording.metadata || {},
      createdAt: recording.created_at.iso8601,
      updatedAt: recording.updated_at.iso8601
    }
  end

  def self.transcript_visible?(recording, context_user)
    return false unless context_user

    context_user.can_edit_sops? || recording.user_id == context_user.id
  end
end
