class User < ApplicationRecord
  has_secure_password

  belongs_to :workspace
  has_many :owned_sops, class_name: "Sop", foreign_key: :owner_id, dependent: :nullify

  ROLES = %w[admin editor viewer].freeze

  validates :email, presence: true, uniqueness: { case_sensitive: false }
  validates :name, presence: true
  validates :role, inclusion: { in: ROLES }

  before_save { self.email = email.downcase if email }

  def admin?
    role == "admin"
  end

  def can_edit_sops?
    role.in?(%w[admin editor])
  end
end
