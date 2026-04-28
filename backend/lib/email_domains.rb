# frozen_string_literal: true

# Known consumer / webmail domains — blocked for workspace signup in production
# (organizations must register with a domain they control).
module EmailDomains
  PERSONAL = %w[
    gmail.com googlemail.com
    outlook.com hotmail.com live.com msn.com
    yahoo.com ymail.com rocketmail.com
    icloud.com me.com mac.com
    proton.me protonmail.com pm.me
    aol.com zoho.com gmx.com mail.com yandex.com
    hey.com fastmail.com tutanota.com tuta.io
  ].freeze

  module_function

  def normalize(domain)
    domain.to_s.downcase.sub(/\Awww\./, '')
  end

  def personal?(domain)
    PERSONAL.include?(normalize(domain))
  end
end
