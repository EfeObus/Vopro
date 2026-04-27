class AuthenticationService
  ALGO = "HS256".freeze

  class << self
    def issue_token(user, ttl: 1.day)
      payload = {
        sub: user.id,
        ws: user.workspace_id,
        role: user.role,
        exp: ttl.from_now.to_i
      }
      JWT.encode(payload, secret, ALGO)
    end

    def user_from_request(request)
      header = request.headers["Authorization"]
      return nil unless header&.start_with?("Bearer ")

      token = header.split(" ", 2).last
      payload, = JWT.decode(token, secret, true, { algorithm: ALGO })
      User.find_by(id: payload["sub"])
    rescue JWT::DecodeError, JWT::ExpiredSignature
      nil
    end

    private

    def secret
      ENV.fetch("VOPRO_JWT_SECRET", Rails.application.secret_key_base)
    end
  end
end
