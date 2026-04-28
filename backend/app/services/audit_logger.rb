# Centralised wrapper around AuditLog so callers don't have to remember every
# required field. Always non-blocking — a logging failure must not break the
# user-facing request.
class AuditLogger
  def self.record(workspace:, user:, action:, subject_type:, subject_id: nil, metadata: {}, request: nil)
    return if workspace.nil?

    enriched = metadata.dup
    if request
      enriched[:ip] = request.remote_ip
      enriched[:user_agent] = request.user_agent.to_s.first(255)
      enriched[:request_id] = request.request_id || request.uuid rescue nil
    end

    AuditLog.create!(
      workspace: workspace,
      user: user,
      action: action,
      subject_type: subject_type.to_s,
      subject_id: subject_id,
      metadata: enriched
    )
  rescue => e
    Rails.logger.warn("[audit-log] failed to write #{action}: #{e.class}: #{e.message}")
    nil
  end
end
