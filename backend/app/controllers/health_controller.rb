class HealthController < ApplicationController
  # Liveness: process is up. Used by Kubernetes liveness probes / dev scripts.
  def show
    render json: {
      status: "ok",
      service: "vopro-backend",
      version: ENV.fetch("VOPRO_VERSION", "0.1.0"),
      time: Time.current.iso8601
    }
  end

  # Readiness: every external dependency we need to serve traffic is reachable.
  # 503 if any of them are not — load balancers should drain the instance.
  def ready
    checks = {
      postgres: probe_postgres,
      redis: probe_redis,
      ai_engine: probe_ai_engine
    }
    healthy = checks.values.all? { |c| c[:ok] }
    render json: {
      status: healthy ? "ok" : "degraded",
      checks: checks,
      time: Time.current.iso8601
    }, status: healthy ? :ok : :service_unavailable
  end

  private

  def probe_postgres
    started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    ActiveRecord::Base.connection.execute("SELECT 1")
    { ok: true, latency_ms: ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1000).round(1) }
  rescue => e
    Rails.logger.warn("[health] postgres probe failed: #{e.class}: #{e.message}")
    { ok: false, error: e.class.name }
  end

  def probe_redis
    started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    Sidekiq.redis { |r| r.ping }
    { ok: true, latency_ms: ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1000).round(1) }
  rescue => e
    Rails.logger.warn("[health] redis probe failed: #{e.class}: #{e.message}")
    { ok: false, error: e.class.name }
  end

  def probe_ai_engine
    base = ENV["VOPRO_AI_BASE_URL"]
    return { ok: true, skipped: true } if base.blank?

    started = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    response = HTTParty.get("#{base}/health", timeout: 2)
    if response.code == 200
      { ok: true, latency_ms: ((Process.clock_gettime(Process::CLOCK_MONOTONIC) - started) * 1000).round(1) }
    else
      { ok: false, status: response.code }
    end
  rescue => e
    Rails.logger.warn("[health] ai-engine probe failed: #{e.class}: #{e.message}")
    { ok: false, error: e.class.name }
  end
end
