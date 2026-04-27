class Integration < ApplicationRecord
  belongs_to :workspace

  PROVIDERS = %w[google microsoft salesforce zendesk notion slack rest].freeze
  STATUSES = %w[connected disconnected error].freeze

  validates :provider, inclusion: { in: PROVIDERS }
  validates :status, inclusion: { in: STATUSES }

  # `secrets` should be encrypted at rest in production
  encrypts :secrets if respond_to?(:encrypts)
end
