class Workflow < ApplicationRecord
  belongs_to :workspace
  has_many :workflow_events, dependent: :nullify
  has_one :sop, dependent: :nullify

  STATUSES = %w[pending sop_generated dismissed].freeze

  validates :title, presence: true
  validates :status, inclusion: { in: STATUSES }

  scope :pending, -> { where(status: "pending") }
end
