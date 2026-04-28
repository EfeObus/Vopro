class UserConsent < ApplicationRecord
  belongs_to :user

  validates :consent_key, presence: true, uniqueness: { scope: :user_id }
  validates :accepted_at, presence: true

  # Stable keys clients send when acknowledging capture policy text.
  KEYS = %w[workflow_capture_policy_v1].freeze
end
