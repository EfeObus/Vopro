# Tracks revoked JWTs by their `jti` claim. Backed by Rails.cache so it picks
# up whatever store the env has configured (memory in test, Redis in
# dev/prod). Each entry is auto-evicted at the JWT's original expiry, so the
# set never grows unbounded.
class TokenDenylist
  KEY_PREFIX = "vopro:jwt:revoked:".freeze

  class << self
    def revoke(jti, exp_unix)
      return false if jti.blank?

      ttl_seconds = [exp_unix.to_i - Time.current.to_i, 1].max
      Rails.cache.write(key(jti), "1", expires_in: ttl_seconds)
      true
    rescue StandardError => e
      Rails.logger.warn("[TokenDenylist] revoke failed: #{e.class}: #{e.message}")
      false
    end

    def revoked?(jti)
      return false if jti.blank?

      Rails.cache.exist?(key(jti))
    rescue StandardError => e
      Rails.logger.warn("[TokenDenylist] check failed: #{e.class}: #{e.message}")
      false # Fail open — better to honour the token than 500 every request.
    end

    private

    def key(jti)
      "#{KEY_PREFIX}#{jti}"
    end
  end
end
