class AuditLog < ApplicationRecord
  belongs_to :workspace
  belongs_to :user, optional: true

  validates :action, presence: true
  validates :subject_type, presence: true
end
