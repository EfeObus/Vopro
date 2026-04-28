# frozen_string_literal: true

# Looks up TXT at `_vopro.<domain>` for substring match e.g. "vopro-verify=abcdef..."
module DnsVerifier
  SUBDOMAIN = "_vopro"

  module_function

  def txt_records_include?(domain, substring)
    return false if domain.blank? || substring.blank?

    name = "#{SUBDOMAIN}.#{domain.strip.sub(/\.\z/, "")}"
    resolver = Resolv::DNS.new
    resolver.timeouts = 5
    recs = resolver.getresources(name, Resolv::DNS::Resource::IN::TXT)
    needle = substring.to_s
    recs.any? do |r|
      blob = Array(r.strings).join(" ").squish
      blob.include?(needle)
    end
  rescue Resolv::ResolvError, SocketError
    false
  end
end
