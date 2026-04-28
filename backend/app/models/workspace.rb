class Workspace < ApplicationRecord
  MASKING_RULE_IDS = %w[email phone cc gov token password].freeze

  BILLING_PLANS = %w[free_trial starter professional enterprise].freeze

  SETTINGS_DEFAULTS = {
    "auto_generate_sop" => false,
    "event_retention_days" => 30,
    "capture_web_enabled" => true,
    "capture_desktop_enabled" => true,
    "capture_terminal_enabled" => false,
    "capture_pause_incognito" => true,
    "masking_rules" => MASKING_RULE_IDS.map { |id| { "id" => id, "enabled" => true } }
  }.freeze

  has_many :users, dependent: :destroy
  has_many :workflows, dependent: :destroy
  has_many :workflow_events, dependent: :destroy
  has_many :sops, dependent: :destroy
  has_many :integrations, dependent: :destroy
  has_many :audit_logs, dependent: :destroy
  has_many :invitations, dependent: :destroy
  has_many :signup_email_tokens, dependent: :destroy
  has_many :call_recordings, dependent: :destroy

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true
  validates :billing_plan, inclusion: { in: BILLING_PLANS }
  validates :seats_limit, numericality: { greater_than: 0 }

  def domain_verified?
    domain_verified_at.present?
  end

  def trial_active?
    trial_ends_at.present? && trial_ends_at > Time.current
  end

  def auto_generate_sop?
    truthy?(merged_settings["auto_generate_sop"])
  end

  def merged_settings
    base = SETTINGS_DEFAULTS.merge(settings || {})
    base["masking_rules"] = self.class.normalize_masking_rules(base["masking_rules"])
    base
  end

  # Normalizes masking toggles to one row per known id (defaults on when omitted).
  def self.normalize_masking_rules(saved)
    overrides = {}
    Array(saved).each do |row|
      next unless row.respond_to?(:[])

      id = (row["id"] || row[:id]).to_s
      next unless MASKING_RULE_IDS.include?(id)

      if row.respond_to?(:key?) && (row.key?("enabled") || row.key?(:enabled))
        raw = row.key?("enabled") ? row["enabled"] : row[:enabled]
        overrides[id] = Workspace.truthy_enabled?(raw)
      end
    end

    MASKING_RULE_IDS.map do |id|
      { "id" => id, "enabled" => overrides.fetch(id, true) }
    end
  end

  def self.truthy_enabled?(value)
    value == true || value.to_s == "true"
  end

  private

  def truthy?(value)
    value == true || value.to_s == "true"
  end
end
