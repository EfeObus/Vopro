require "httparty"

# Client for the Python ai-engine service. Uses bounded exponential backoff
# for transient failures (timeouts, 5xx, connection refused) and bubbles up
# 4xx without retry — those are programming errors, not network blips.
class AiEngineClient
  include HTTParty

  # AI_ENGINE_URL is the historical name; VOPRO_AI_BASE_URL is the
  # documented one. Honour both, with the documented one winning.
  base_uri (ENV["VOPRO_AI_BASE_URL"].presence || ENV.fetch("AI_ENGINE_URL", "http://localhost:8000"))
  default_timeout 30

  MAX_RETRIES = 3
  BASE_BACKOFF = 0.4 # seconds; 0.4, 0.8, 1.6 with jitter

  RETRYABLE_ERRORS = [
    Net::ReadTimeout,
    Net::OpenTimeout,
    Errno::ECONNREFUSED,
    Errno::ECONNRESET,
    SocketError,
    HTTParty::Error
  ].freeze

  class Error < StandardError
    attr_reader :status, :body

    def initialize(message, status: nil, body: nil)
      super(message)
      @status = status
      @body = body
    end
  end

  def self.detect_patterns(events:)
    request(:post, "/detect", body: { events: events })
  end

  def self.generate_sop(workflow:, events:)
    request(:post, "/generate", body: { workflow: workflow, events: events })
  end

  def self.generate_from_transcript(transcript:, title_hint: nil)
    body = { transcript: transcript.to_s, title_hint: title_hint }
    # Longer than default — GPT structuring large transcripts can exceed 30s.
    request(:post, "/generate_from_transcript", body: body, timeout: 120)
  end

  def self.request(verb, path, body: nil, timeout: nil)
    last_error = nil
    attempt = 0

    while attempt < MAX_RETRIES
      attempt += 1
      began = Process.clock_gettime(Process::CLOCK_MONOTONIC)

      begin
        http_opts = {
          body: body&.to_json,
          headers: { "Content-Type" => "application/json" }
        }
        http_opts[:timeout] = timeout if timeout.present?
        response = send(verb, path, http_opts)
      rescue *RETRYABLE_ERRORS => e
        last_error = e
        wait = backoff(attempt)
        Rails.logger.warn("[ai-engine] #{e.class} on #{verb} #{path} (attempt #{attempt}); retrying in #{wait}s")
        sleep(wait) if attempt < MAX_RETRIES
        next
      end

      ms = ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - began) * 1000).round
      Rails.logger.info("[ai-engine] #{verb.upcase} #{path} → #{response.code} in #{ms}ms (attempt #{attempt})")

      if response.success?
        return response.parsed_response
      end

      if response.code >= 500 && attempt < MAX_RETRIES
        wait = backoff(attempt)
        Rails.logger.warn("[ai-engine] #{response.code} on #{verb} #{path} (attempt #{attempt}); retrying in #{wait}s")
        sleep(wait)
        next
      end

      raise Error.new("ai-engine #{response.code}", status: response.code, body: response.body)
    end

    raise Error.new("ai-engine unreachable: #{last_error&.class}: #{last_error&.message}")
  end

  def self.backoff(attempt)
    BASE_BACKOFF * (2**(attempt - 1)) * (0.7 + Kernel.rand * 0.6)
  end
end
