# frozen_string_literal: true

require "rails_helper"

RSpec.describe CallRecordingSopSteps do
  it "normalizes string-key hashes" do
    out = described_class.normalize(
      [
        { "title" => "A", "description" => "Do A", "order" => 1 },
        { "title" => "B", "description" => "Do B" }
      ]
    )
    expect(out.length).to eq(2)
    expect(out.first["title"]).to eq("A")
    expect(out.first["id"]).to eq("s1")
    expect(out.second["order"]).to eq(2)
  end

  it "accepts symbol keys from parsed JSON-style hashes" do
    out = described_class.normalize(
      [{ title: "Hello", description: "World", order: 1 }]
    )
    expect(out.first["title"]).to eq("Hello")
    expect(out.first["description"]).to eq("World")
  end

  it "fills missing titles" do
    out = described_class.normalize([{ "description" => "only desc" }])
    expect(out.first["title"]).to include("Step")
  end
end
