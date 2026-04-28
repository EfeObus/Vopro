require "rails_helper"

RSpec.describe AiEngineClient do
  before do
    # Don't actually sleep between retries.
    allow(described_class).to receive(:sleep)
  end

  def fake_response(code:, body: "{}")
    double("HTTParty::Response", success?: code.between?(200, 299), code: code, body: body,
                                  parsed_response: JSON.parse(body))
  end

  it "retries on a 5xx response and returns the eventual success" do
    expect(described_class).to receive(:post).twice.and_return(
      fake_response(code: 503),
      fake_response(code: 200, body: { ok: true }.to_json)
    )

    out = described_class.generate_sop(workflow: { id: "w1" }, events: [])
    expect(out).to eq("ok" => true)
  end

  it "retries on a transient connection refusal and then succeeds" do
    refused = Errno::ECONNREFUSED.new("connection refused")
    expect(described_class).to receive(:post).twice.and_invoke(
      ->(*_) { raise refused },
      ->(*_) { fake_response(code: 200, body: { ok: true }.to_json) }
    )

    expect(described_class.detect_patterns(events: [])).to eq("ok" => true)
  end

  it "does not retry on a 4xx response" do
    expect(described_class).to receive(:post).once.and_return(
      fake_response(code: 422, body: { error: "bad" }.to_json)
    )
    expect {
      described_class.generate_sop(workflow: { id: "w1" }, events: [])
    }.to raise_error(AiEngineClient::Error, /422/)
  end

  it "gives up with an Error after exhausting retries" do
    expect(described_class).to receive(:post).exactly(3).times.and_return(fake_response(code: 500))
    expect {
      described_class.generate_sop(workflow: { id: "w1" }, events: [])
    }.to raise_error(AiEngineClient::Error, /500/)
  end
end
