# Active Record encryption keys. In production these belong in
# Rails.application.credentials; for local dev/test we read them from .env.
#
# Generate with: bin/rails db:encryption:init

Rails.application.config.active_record.encryption.tap do |enc|
  enc.primary_key          = ENV["AR_ENCRYPTION_PRIMARY_KEY"]
  enc.deterministic_key    = ENV["AR_ENCRYPTION_DETERMINISTIC_KEY"]
  enc.key_derivation_salt  = ENV["AR_ENCRYPTION_KEY_DERIVATION_SALT"]
end
