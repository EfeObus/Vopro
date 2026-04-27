class WorkflowEvent < ApplicationRecord
  belongs_to :workspace
  belongs_to :user
  belongs_to :workflow, optional: true

  KINDS = %w[click input navigation focus blur form_submit shortcut copy paste open close].freeze

  validates :kind, inclusion: { in: KINDS }
  validates :occurred_at, presence: true

  scope :recent, ->(since = 7.days.ago) { where("occurred_at >= ?", since) }
  scope :for_application, ->(app) { where(application: app) }

  before_create :ensure_normalized_payload

  private

  # Normalize payload to ensure no raw PII slipped through. The agent is
  # responsible for masking, but we double-check here as defense in depth.
  def ensure_normalized_payload
    self.payload = MaskingService.scrub(payload || {})
  end
end
