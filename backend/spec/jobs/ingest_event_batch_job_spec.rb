require "rails_helper"

RSpec.describe IngestEventBatchJob, type: :job do
  let(:workspace) { create(:workspace) }
  let(:user)      { create(:user, workspace: workspace) }

  it "inserts events with masked payloads" do
    events = [
      {
        "kind" => "click",
        "application" => "Salesforce",
        "target" => "Convert",
        "payload" => { "email" => "person@example.com", "note" => "ok" },
        "occurred_at" => Time.current.iso8601
      }
    ]

    expect {
      described_class.new.perform(workspace.id, user.id, "device-abc", events)
    }.to change(WorkflowEvent, :count).by(1)

    row = WorkflowEvent.order(created_at: :desc).first
    expect(row.kind).to eq("click")
    expect(row.device_id).to eq("device-abc")
    expect(row.payload["email"]).not_to include("person@example.com")
  end

  it "is a no-op when the events array is empty" do
    expect {
      described_class.new.perform(workspace.id, user.id, "device-abc", [])
    }.not_to change(WorkflowEvent, :count)
  end
end
