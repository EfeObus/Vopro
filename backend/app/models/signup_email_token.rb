class SignupEmailToken < ApplicationRecord
  belongs_to :workspace

  validates :token, presence: true, uniqueness: true
  validates :expires_at, presence: true

  scope :usable, -> {
    where(consumed_at: nil).where("expires_at > ?", Time.current)
  }

  def consume!
    update!(consumed_at: Time.current)
  end

  def usable?
    consumed_at.nil? && expires_at > Time.current
  end
end
