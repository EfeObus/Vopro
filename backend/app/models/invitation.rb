class Invitation < ApplicationRecord
  belongs_to :workspace
  belongs_to :inviter, class_name: "User", optional: true

  TOKEN_TTL = 7.days
  ROLES = %w[admin editor viewer].freeze

  validates :email, presence: true,
                    format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :role,  inclusion: { in: ROLES }
  validates :token, presence: true, uniqueness: true

  before_validation :generate_token,    on: :create
  before_validation :set_expires_at,    on: :create
  before_validation :normalise_email

  scope :active, -> {
    where(accepted_at: nil, revoked_at: nil)
      .where("expires_at > ?", Time.current)
  }

  def expired?
    expires_at <= Time.current
  end

  def accepted?
    accepted_at.present?
  end

  def revoked?
    revoked_at.present?
  end

  def usable?
    !accepted? && !revoked? && !expired?
  end

  private

  def generate_token
    self.token ||= SecureRandom.urlsafe_base64(32)
  end

  def set_expires_at
    self.expires_at ||= TOKEN_TTL.from_now
  end

  def normalise_email
    self.email = email.to_s.strip.downcase if email
  end
end
