require "rails_helper"

RSpec.describe RefreshSopJob, type: :job do
  let(:workspace) { create(:workspace) }
  let(:user)      { create(:user, workspace: workspace) }
  let(:workflow)  { create(:workflow, workspace: workspace) }
  let(:sop) do
    create(:sop, workspace: workspace, workflow: workflow, status: "published",
                  steps: [
                    { "id" => "s1", "order" => 1, "title" => "Open", "description" => "" },
                    { "id" => "s2", "order" => 2, "title" => "Convert", "description" => "" }
                  ])
  end

  before do
    create(:workflow_event, workspace: workspace, user: user, workflow: workflow, occurred_at: 1.day.ago)
  end

  it "marks the SOP needs_review when ai-engine output drifts from current steps" do
    sop # materialize
    allow(AiEngineClient).to receive(:generate_sop).and_return(
      "steps" => [
        { "id" => "s1", "order" => 1, "title" => "Open", "description" => "" },
        { "id" => "s3", "order" => 2, "title" => "Convert and notify CSM", "description" => "" }
      ],
      "confidence" => 0.88
    )

    expect {
      described_class.new.perform
    }.to change { sop.reload.status }.from("published").to("needs_review")
     .and change(SopVersion, :count).by(1)
  end

  it "does not change anything when steps match" do
    sop
    allow(AiEngineClient).to receive(:generate_sop).and_return(
      "steps" => sop.steps.map(&:to_h),
      "confidence" => 0.9
    )

    expect {
      described_class.new.perform
    }.not_to change { sop.reload.status }
  end
end
