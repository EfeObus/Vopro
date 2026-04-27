require "httparty"

# Client for the Python ai-engine service.
class AiEngineClient
  include HTTParty

  base_uri ENV.fetch("AI_ENGINE_URL", "http://localhost:8000")
  default_timeout 30

  def self.detect_patterns(events:)
    response = post("/detect", body: { events: events }.to_json,
                              headers: { "Content-Type" => "application/json" })
    raise "ai-engine error: #{response.code}" unless response.success?

    response.parsed_response
  end

  def self.generate_sop(workflow:, events:)
    response = post("/generate",
                    body: { workflow: workflow, events: events }.to_json,
                    headers: { "Content-Type" => "application/json" })
    raise "ai-engine error: #{response.code}" unless response.success?

    response.parsed_response
  end
end
