class SopVersion < ApplicationRecord
  belongs_to :sop

  validates :version, presence: true, uniqueness: { scope: :sop_id }
  validates :authored_by, presence: true
end
