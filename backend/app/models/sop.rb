class Sop < ApplicationRecord
  belongs_to :workspace
  belongs_to :owner, class_name: "User", optional: true
  belongs_to :workflow, optional: true
  has_many :sop_versions, dependent: :destroy

  STATUSES = %w[draft published needs_review archived].freeze

  validates :title, presence: true
  validates :status, inclusion: { in: STATUSES }

  # `steps` is a JSONB column holding an ordered array of:
  #   { id, order, title, description, application,
  #     decision: { question, branches: [{ label, go_to_step_id, occurrences? }] } }
  # Stored snake_case; SopSerializer.detail camelises keys for API responses.

  def next_version_number
    (sop_versions.maximum(:version) || 0) + 1
  end

  def as_versioned_snapshot
    attributes.slice("title", "description", "status", "tags", "steps", "confidence")
  end

  def average_duration_sec
    self[:average_duration_sec] || 0
  end
end
