class User < ApplicationRecord
  has_secure_password

  belongs_to :workspace
  has_many :owned_sops, class_name: "Sop", foreign_key: :owner_id, dependent: :nullify
  has_many :password_reset_tokens, dependent: :destroy
  has_many :user_consents, dependent: :destroy
  has_many :call_recordings, dependent: :destroy

  ROLES = %w[admin editor viewer].freeze

  validates :email, presence: true, uniqueness: { case_sensitive: false }
  validates :name, presence: true
  validates :role, inclusion: { in: ROLES }

  before_save { self.email = email.downcase if email }

  # GDPR-anonymised accounts have `deleted_at` set. They must not be able to
  # keep using a previously-issued JWT or otherwise resolve as a logged-in
  # user.
  scope :kept, -> { where(deleted_at: nil) }

  def deleted?
    deleted_at.present?
  end

  def admin?
    role == "admin"
  end

  def can_edit_sops?
    role.in?(%w[admin editor])
  end

  def consented?(key)
    user_consents.exists?(consent_key: key)
  end
end
