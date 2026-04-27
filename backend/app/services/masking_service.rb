class MaskingService
  EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/
  PHONE = /\+?\d[\d\s().-]{7,}\d/
  SSN = /\b\d{3}-\d{2}-\d{4}\b/
  CREDIT_CARD = /\b(?:\d[ -]*?){13,19}\b/
  TOKEN = /\b(?:sk|pk|ghp|github_pat|xox[abp])[_\-][A-Za-z0-9_\-]{16,}\b/
  JWT = /\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b/

  RULES = {
    "[email-redacted]" => EMAIL,
    "[phone-redacted]" => PHONE,
    "[ssn-redacted]" => SSN,
    "[card-redacted]" => CREDIT_CARD,
    "[token-redacted]" => TOKEN,
    "[jwt-redacted]" => JWT
  }.freeze

  class << self
    def scrub(value)
      case value
      when String then scrub_string(value)
      when Array  then value.map { |v| scrub(v) }
      when Hash   then value.transform_values { |v| scrub(v) }
      else value
      end
    end

    def scrub_string(str)
      RULES.reduce(str) { |acc, (mask, pattern)| acc.gsub(pattern, mask) }
    end
  end
end
