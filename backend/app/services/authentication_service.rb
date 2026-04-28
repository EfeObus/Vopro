class AuthenticationService
  ALGO = "HS256".freeze

  class << self
    def issue_token(user, ttl: 1.day)
      payload = {
        sub: user.id,
        ws: user.workspace_id,
        role: user.role,
        jti: SecureRandom.uuid,
        iat: Time.current.to_i,
        exp: ttl.from_now.to_i
      }
      JWT.encode(payload, secret, ALGO)
    end

    # Decode a token and return its raw JWT payload, or nil if the token is
    # invalid, expired, or revoked. Used by the logout endpoint, which needs
    # the `jti`/`exp` even though the user lookup also happens elsewhere.
    def decode(token)
      payload, = JWT.decode(token, secret, true, { algorithm: ALGO })
      return nil if payload["jti"].present? && TokenDenylist.revoked?(payload["jti"])

      payload
    rescue JWT::DecodeError, JWT::ExpiredSignature
      nil
    end

    def user_from_request(request)
      header = request.headers["Authorization"]
      return nil unless header&.start_with?("Bearer ")

      token = header.split(" ", 2).last
      payload = decode(token)
      return nil unless payload

      # `kept` filters out GDPR-anonymised users so a stolen JWT can't outlive
      # an account deletion.
      User.kept.find_by(id: payload["sub"])
    end

    def revoke_request_token!(request)
      header = request.headers["Authorization"]
      return false unless header&.start_with?("Bearer ")

      token = header.split(" ", 2).last
      payload, = JWT.decode(token, secret, true, { algorithm: ALGO })
      return false if payload["jti"].blank?

      TokenDenylist.revoke(payload["jti"], payload["exp"])
    rescue JWT::DecodeError, JWT::ExpiredSignature
      false
    end

    private

    def secret
      # JWT_SECRET is the documented variable; VOPRO_JWT_SECRET kept as a fallback
      # for any operator that adopted the older name. Final fallback is
      # secret_key_base so dev/test still works without explicit configuration.
      ENV["JWT_SECRET"].presence ||
        ENV["VOPRO_JWT_SECRET"].presence ||
        Rails.application.secret_key_base
    end
  end
end
