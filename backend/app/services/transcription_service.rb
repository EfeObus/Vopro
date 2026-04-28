# frozen_string_literal: true

require "net/http"
require "json"
require "uri"
require "net/http/post/multipart"

# Sends audio to OpenAI Whisper (`whisper-1`). Requires OPENAI_API_KEY.
class TranscriptionService
  class Error < StandardError; end

  WHISPER_ENDPOINT = "https://api.openai.com/v1/audio/transcriptions"

  # @param path [String] absolute path to audio file on disk
  # @param filename [String] original filename (extension matters for Whisper)
  # @param content_type [String] MIME type
  # @return [String] plain transcript text
  def self.transcribe!(path:, filename:, content_type:)
    key = ENV.fetch("OPENAI_API_KEY", "").to_s.strip
    raise Error, "OPENAI_API_KEY is not configured — cannot transcribe call audio" if key.blank?

    uri = URI.parse(WHISPER_ENDPOINT)
    raise Error, "Audio file missing: #{path}" unless File.file?(path.to_s)

    File.open(path.to_s, "rb") do |io|
      upload = Multipart::Post::UploadIO.new(
        io,
        content_type.presence || "application/octet-stream",
        File.basename(filename.to_s)
      )
      req = Net::HTTP::Post::Multipart.new(
        uri.path,
        "file" => upload,
        "model" => "whisper-1"
      )
      req["Authorization"] = "Bearer #{key}"

      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = true
      http.open_timeout = 15
      http.read_timeout = 120

      res = http.request(req)
      unless res.is_a?(Net::HTTPSuccess)
        body_preview = res.body.to_s.first(500)
        raise Error, "Whisper API error (#{res.code}): #{body_preview}"
      end

      parsed = JSON.parse(res.body)
      text = parsed["text"].to_s.strip
      raise Error, "Whisper returned empty transcript" if text.blank?

      text
    end
  rescue JSON::ParserError => e
    raise Error, "Invalid Whisper response: #{e.message}"
  end
end
