require "rails_helper"

RSpec.describe IntegrationSyncJob, type: :job do
  it "invokes IntegrationPullService for each connected integration" do
    ws = create(:workspace)
    a = create(:integration, workspace: ws, provider: "google", status: "connected")
    _b = create(:integration, workspace: ws, provider: "slack", status: "disconnected")

    allow(IntegrationPullService).to receive(:sync!)

    described_class.new.perform

    expect(IntegrationPullService).to have_received(:sync!).once.with(a)
  end
end
