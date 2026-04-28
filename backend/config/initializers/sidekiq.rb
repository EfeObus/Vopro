require "sidekiq"
require "sidekiq/cron"

redis_url = ENV.fetch("REDIS_URL", "redis://localhost:6379/0")

Sidekiq.configure_server do |config|
  config.redis = { url: redis_url }

  config.on(:startup) do
    schedule_path = Rails.root.join("config", "sidekiq.yml")
    next unless File.exist?(schedule_path)

    yaml = YAML.load_file(schedule_path)
    schedule = yaml.is_a?(Hash) ? yaml.dig(:scheduler, :schedule) || yaml.dig("scheduler", "schedule") : nil
    next unless schedule.is_a?(Hash) && schedule.any?

    Sidekiq::Cron::Job.load_from_hash!(schedule)
    Rails.logger.info("[sidekiq-cron] loaded #{schedule.size} scheduled job(s)")
  end
end

Sidekiq.configure_client do |config|
  config.redis = { url: redis_url }
end
