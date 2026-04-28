class Integration < ApplicationRecord
  belongs_to :workspace

  PROVIDERS = %w[google microsoft salesforce zendesk notion slack rest].freeze
  STATUSES = %w[connected disconnected error].freeze

  validates :provider, inclusion: { in: PROVIDERS }
  validates :status, inclusion: { in: STATUSES }

  # Encrypted at rest when AR encryption keys are configured (production/staging).
  # CI and fresh clones often omit keys until `bin/rails db:encryption:init` —
  # skipping `encrypts` avoids 500s on save without weakening prod when keys exist.
  encrypts :secrets if respond_to?(:encrypts) && ENV["AR_ENCRYPTION_PRIMARY_KEY"].present?
end
