require "spec_helper"
require_relative "../../app/services/masking_service"

RSpec.describe MaskingService do
  it "redacts emails" do
    expect(described_class.scrub("ping me at jane.doe@example.com")).to include("[email-redacted]")
  end

  it "redacts JWTs" do
    jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature_value_value"
    expect(described_class.scrub(jwt)).to eq("[jwt-redacted]")
  end

  it "scrubs deeply nested hashes" do
    input = { user: { contact: { email: "x@y.com", note: "fine" } } }
    output = described_class.scrub(input)
    expect(output.dig(:user, :contact, :email)).to eq("[email-redacted]")
    expect(output.dig(:user, :contact, :note)).to eq("fine")
  end

  it "scrubs arrays of strings" do
    expect(described_class.scrub(["a@b.com", "ok"])).to eq(["[email-redacted]", "ok"])
  end
end
