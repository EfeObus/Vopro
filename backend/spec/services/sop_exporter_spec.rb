require "rails_helper"

RSpec.describe SopExporter do
  let(:sop) do
    instance_double(
      Sop,
      id: "11111111-1111-1111-1111-111111111111",
      title: "Refund workflow",
      description: "Handle refunds consistently.",
      status: "published",
      tags: %w[support billing],
      confidence: 0.82,
      steps: [
        {
          "title" => "Verify order",
          "description" => "Find the order in CRM.",
          "application" => "Salesforce",
        },
        {
          "title" => "Refund path",
          "description" => "Choose branch.",
          "decision" => {
            "question" => "Amount over $500?",
            "branches" => [{ "label" => "Yes" }, { "label" => "No" }],
          },
        },
      ],
    )
  end

  describe ".call format: :pdf" do
    it "returns binary PDF bytes with a valid header" do
      bytes = described_class.call(sop, format: :pdf)
      expect(bytes.byteslice(0, 4)).to eq("%PDF")
      expect(bytes.bytesize).to be > 200
    end
  end

  describe ".call format: :markdown" do
    it "includes the title" do
      md = described_class.call(sop, format: :markdown)
      expect(md).to include("# Refund workflow")
    end
  end
end
