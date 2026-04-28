require "rails_helper"

RSpec.describe DetectPatternsJob, type: :job do
  let(:workspace) { create(:workspace) }
  let(:user)      { create(:user, workspace: workspace) }

  it "creates Workflow rows for each candidate the AI engine returns" do
    create(:workflow_event, workspace: workspace, user: user, kind: "navigation")
    create(:workflow_event, workspace: workspace, user: user, kind: "click")

    response = {
      "candidates" => [
        {
          "signature" => "sig-new-1",
          "title" => "New triage flow",
          "application" => "Zendesk",
          "occurrences" => 4,
          "last_seen" => Time.current.iso8601,
          "confidence" => 0.74
        }
      ]
    }
    allow(AiEngineClient).to receive(:detect_patterns).and_return(response)

    expect {
      described_class.new.perform
    }.to change { workspace.workflows.count }.by(1)

    new_workflow = workspace.workflows.find_by(signature: "sig-new-1")
    expect(new_workflow.title).to eq("New triage flow")
    expect(new_workflow.status).to eq("pending")
  end

  it "does nothing when there are no events" do
    allow(AiEngineClient).to receive(:detect_patterns)
    described_class.new.perform
    expect(AiEngineClient).not_to have_received(:detect_patterns)
  end
end
