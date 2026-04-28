class PasswordResetToken < ApplicationRecord
  belongs_to :user

  TOKEN_TTL = 1.hour

  validates :token, presence: true, uniqueness: true

  before_validation :generate_token, on: :create
  before_validation :set_expires_at, on: :create

  scope :active, -> {
    where(consumed_at: nil)
      .where("expires_at > ?", Time.current)
  }

  def expired?
    expires_at <= Time.current
  end

  def consumed?
    consumed_at.present?
  end

  def usable?
    !consumed? && !expired?
  end

  def consume!
    update!(consumed_at: Time.current)
  end

  private

  def generate_token
    self.token ||= SecureRandom.urlsafe_base64(32)
  end

  def set_expires_at
    self.expires_at ||= TOKEN_TTL.from_now
  end
end
