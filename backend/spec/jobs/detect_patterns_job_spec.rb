require "rails_helper"

RSpec.describe DetectPatternsJob, type: :job do
  let(:workspace) { create(:workspace) }
  let(:user)      { create(:user, workspace: workspace) }

  it "creates Workflow rows for each candidate the AI engine returns" do
    e1 = create(:workflow_event, workspace: workspace, user: user, kind: "navigation")
    e2 = create(:workflow_event, workspace: workspace, user: user, kind: "click")

    response = {
      "candidates" => [
        {
          "signature" => "sig-new-1",
          "title" => "New triage flow",
          "application" => "Zendesk",
          "occurrences" => 4,
          "last_seen" => Time.current.iso8601,
          "confidence" => 0.74,
          "linked_event_ids" => [e1.id, e2.id]
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
    expect(e1.reload.workflow_id).to eq(new_workflow.id)
    expect(e2.reload.workflow_id).to eq(new_workflow.id)
  end

  it "enqueues GenerateSopJob when the workspace opts into auto-generation for new workflows" do
    workspace.update!(settings: workspace.settings.merge("auto_generate_sop" => true))

    e1 = create(:workflow_event, workspace: workspace, user: user, kind: "navigation")
    e2 = create(:workflow_event, workspace: workspace, user: user, kind: "click")
    e3 = create(:workflow_event, workspace: workspace, user: user, kind: "input")

    response = {
      "candidates" => [
        {
          "signature" => "sig-auto-1",
          "title" => "Auto flow",
          "application" => "App",
          "occurrences" => 3,
          "last_seen" => Time.current.iso8601,
          "confidence" => 0.9,
          "linked_event_ids" => [e1.id, e2.id, e3.id]
        }
      ]
    }
    allow(AiEngineClient).to receive(:detect_patterns).and_return(response)

    expect {
      described_class.new.perform
    }.to change(GenerateSopJob.jobs, :size).by(1)

    wf = workspace.workflows.find_by(signature: "sig-auto-1")
    expect(GenerateSopJob.jobs.last["args"]).to eq([wf.id])
  end

  it "does nothing when there are no events" do
    allow(AiEngineClient).to receive(:detect_patterns)
    described_class.new.perform(workspace.id)
    expect(AiEngineClient).not_to have_received(:detect_patterns)
  end
end
