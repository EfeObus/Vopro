require "rails_helper"

RSpec.describe GenerateSopJob, type: :job do
  let(:workspace) { create(:workspace) }
  let(:user)      { create(:user, workspace: workspace) }
  let(:workflow)  { create(:workflow, workspace: workspace) }

  before do
    create(:workflow_event, workspace: workspace, user: user, workflow: workflow,
                            kind: "navigation", target: "Open opportunity")
    create(:workflow_event, workspace: workspace, user: user, workflow: workflow,
                            kind: "click",      target: "Convert")
  end

  it "calls the AI engine and creates a draft SOP + version" do
    fake = {
      "title" => "Convert opportunity",
      "description" => "Steps to convert.",
      "tags" => ["Salesforce"],
      "steps" => [
        { "id" => "s1", "order" => 1, "title" => "Open opportunity", "description" => "..." },
        { "id" => "s2", "order" => 2, "title" => "Click Convert",     "description" => "..." }
      ],
      "confidence" => 0.91,
      "average_duration_sec" => 120,
      "contributors" => 2
    }
    allow(AiEngineClient).to receive(:generate_sop).and_return(fake)

    expect {
      described_class.new.perform(workflow.id)
    }.to change(Sop, :count).by(1)
     .and change(SopVersion, :count).by(1)

    sop = Sop.find_by(workflow_id: workflow.id)
    expect(sop.title).to eq("Convert opportunity")
    expect(sop.status).to eq("draft")
    expect(sop.steps.size).to eq(2)
    expect(workflow.reload.status).to eq("sop_generated")
  end
end
