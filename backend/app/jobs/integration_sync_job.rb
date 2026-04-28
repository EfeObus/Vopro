class IntegrationSyncJob
  include Sidekiq::Job
  sidekiq_options queue: :low, retry: 2

  def perform
    Integration.where(status: "connected").find_each do |integration|
      IntegrationPullService.sync!(integration)
    rescue StandardError => e
      Rails.logger.warn("[integration-sync] #{integration.id}: #{e.class}: #{e.message}")
    end
  end
end
