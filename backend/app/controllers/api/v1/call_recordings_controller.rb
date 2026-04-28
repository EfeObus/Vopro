# frozen_string_literal: true

module Api
  module V1
    class CallRecordingsController < ApplicationController
      before_action :authenticate_user!

      MAX_AUDIO_BYTES = 24 * 1024 * 1024 # Whisper limit ~25MB; stay under
      MIN_AUDIO_BYTES = 16 # reject empty / trivial uploads early
      ALLOWED_EXTENSIONS = %w[.flac .m4a .mp3 .mp4 .mpeg .mpga .oga .ogg .wav .webm].freeze

      def index
        recs = current_user.workspace.call_recordings.order(created_at: :desc).limit(100)
        render json: recs.map { |r| CallRecordingSerializer.call(r, context_user: current_user) }
      end

      def show
        rec = current_user.workspace.call_recordings.find(params[:id])
        render json: CallRecordingSerializer.call(rec, context_user: current_user)
      end

      def create
        raise Forbidden unless current_user.can_edit_sops?

        uploaded = params[:audio]
        unless uploaded.respond_to?(:tempfile) && uploaded.tempfile
          return render_error(status: :bad_request, code: "missing_audio", message: "Multipart field `audio` is required")
        end

        original = uploaded.original_filename.to_s
        ext = File.extname(original).downcase
        unless ALLOWED_EXTENSIONS.include?(ext)
          return render_error(
            status: :unprocessable_entity,
            code: "unsupported_audio_type",
            message: "Allowed formats: #{ALLOWED_EXTENSIONS.join(', ')}",
            details: { ext: ext.presence || "(none)" }
          )
        end

        uploaded.tempfile.rewind if uploaded.tempfile.respond_to?(:rewind)
        size = uploaded.size.to_i

        if size.zero?
          return render_error(
            status: :unprocessable_entity,
            code: "audio_empty",
            message: "Audio file is empty",
            details: { min_bytes: MIN_AUDIO_BYTES }
          )
        end

        if size > MAX_AUDIO_BYTES
          return render_error(
            status: :payload_too_large,
            code: "audio_too_large",
            message: "Audio must be #{MAX_AUDIO_BYTES / 1.megabyte}MB or smaller",
            details: { max_bytes: MAX_AUDIO_BYTES }
          )
        end

        if size.positive? && size < MIN_AUDIO_BYTES
          return render_error(
            status: :unprocessable_entity,
            code: "audio_too_small",
            message: "Audio file is too small or empty",
            details: { min_bytes: MIN_AUDIO_BYTES }
          )
        end

        title_hint = params[:title_hint].to_s.presence
        meta = { original_filename: original, uploaded_byte_size: size }

        recording = nil
        dest_path = nil

        recording = current_user.workspace.call_recordings.create!(
          user: current_user,
          status: "pending",
          title_hint: title_hint,
          metadata: meta,
          audio_content_type: uploaded.content_type.presence || Rack::Mime.mime_type(ext),
          audio_byte_size: size.positive? ? size : nil
        )

        dir = Rails.root.join("storage", "call_recordings", current_user.workspace_id.to_s)
        FileUtils.mkdir_p(dir)
        dest_path = dir.join("#{recording.id}#{ext}")
        File.binwrite(dest_path, uploaded.read)
        uploaded.tempfile.close if uploaded.tempfile.respond_to?(:close)

        written = File.size(dest_path)
        if written > MAX_AUDIO_BYTES
          cleanup_failed_upload(recording, dest_path)
          return render_error(
            status: :payload_too_large,
            code: "audio_too_large",
            message: "Stored file exceeds the maximum allowed size",
            details: { max_bytes: MAX_AUDIO_BYTES }
          )
        end

        if written < MIN_AUDIO_BYTES
          cleanup_failed_upload(recording, dest_path)
          return render_error(
            status: :unprocessable_entity,
            code: "audio_too_small",
            message: "Audio file is too small or empty",
            details: { min_bytes: MIN_AUDIO_BYTES }
          )
        end

        rel = dest_path.relative_path_from(Rails.root).to_s
        recording.update!(
          audio_file_path: rel,
          audio_byte_size: written
        )

        AuditLogger.record(
          workspace: current_user.workspace,
          user: current_user,
          action: "call_recording.create",
          subject_type: "CallRecording",
          subject_id: recording.id,
          metadata: { bytes: recording.audio_byte_size, content_type: recording.audio_content_type },
          request: request
        )

        ProcessCallRecordingJob.perform_async(recording.id)

        render json: CallRecordingSerializer.call(recording.reload, context_user: current_user), status: :accepted
      rescue Forbidden
        raise
      rescue RedisClient::CannotConnectError, Redis::CannotConnectError
        cleanup_failed_upload(recording, dest_path)
        raise
      rescue StandardError => e
        Rails.logger.error("[call-recordings#create] #{e.class}: #{e.message}\n#{e.backtrace&.first(8)&.join("\n")}")
        cleanup_failed_upload(recording, dest_path)
        render_error(status: :internal_server_error, code: "upload_failed", message: "Could not store call recording")
      end

      private

      def cleanup_failed_upload(recording, dest_path)
        FileUtils.rm_f(dest_path.to_s) if dest_path
        recording&.destroy
      rescue StandardError => e
        Rails.logger.warn("[call-recordings#cleanup] #{e.class}: #{e.message}")
      end
    end
  end
end
