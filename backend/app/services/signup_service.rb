# frozen_string_literal: true

# Orchestrates tenant signup: validations, workspace + admin user, verification token.
class SignupService
  class << self
    def perform(signup_params, frontend_origin:)
      new(signup_params, frontend_origin: frontend_origin).perform
    end
  end

  def initialize(signup_params, frontend_origin:)
    @p = signup_params
    @frontend_origin = frontend_origin
  end

  # Returns { ok: true, workspace:, user:, raw_token: } or { ok: false, error: { ... } }
  def perform
    email = @p.require(:admin_email).to_s.strip.downcase
    claimed = EmailDomains.normalize(@p.require(:claimed_domain))
    email_domain = EmailDomains.normalize(email.split('@').last)

    unless Rails.env.development?
      if EmailDomains.personal?(email_domain)
        return err(
          status: :unprocessable_entity,
          code: 'personal_email_not_allowed',
          message: 'Use your company email address to register a workspace.',
          details: { email_domain: email_domain }
        )
      end

      if email_domain != claimed
        return err(
          status: :unprocessable_entity,
          code: 'domain_mismatch',
          message: 'Admin email must use the claimed company domain',
          details: { claimed_domain: claimed, email_domain: email_domain }
        )
      end
    end

    claimed = email_domain if Rails.env.development? && email_domain != claimed

    pwd = @p.require(:admin_password).to_s
    if pwd.length < 12
      return err(
        status: :unprocessable_entity,
        code: 'weak_password',
        message: 'Password must be at least 12 characters',
        details: { min_length: 12 }
      )
    end

    workspace = nil
    user = nil
    raw_token = nil

    ActiveRecord::Base.transaction do
      base_slug = @p[:slug].presence || @p.require(:workspace_name)
      slug = unique_slug(base_slug)

      workspace = Workspace.create!(
        name: @p.require(:workspace_name).to_s.strip,
        slug: slug,
        claimed_domain: claimed,
        billing_plan: Workspace::BILLING_PLANS.include?(@p[:billing_plan].to_s) ? @p[:billing_plan].to_s : 'free_trial',
        trial_ends_at: 14.days.from_now,
        seats_limit: [[@p[:seats_limit].to_i, 1].max, 50_000].min
      )

      user = workspace.users.create!(
        email: email,
        name: @p.require(:admin_name).to_s.strip,
        password: pwd,
        role: 'admin'
      )

      raw_token = SecureRandom.urlsafe_base64(32)
      workspace.signup_email_tokens.create!(
        token: raw_token,
        expires_at: 24.hours.from_now
      )
    end

    verify_url = "#{@frontend_origin.chomp('/')}/verify-email?token=#{raw_token}"
    SignupMailer.verify_email(
      to: user.email,
      workspace_name: workspace.name,
      verify_url: verify_url
    ).deliver_now

    Rails.logger.info("[Signup] Verification URL for #{user.email}: #{verify_url}") if Rails.env.development?

    { ok: true, workspace: workspace, user: user, raw_token: raw_token }
  rescue ActiveRecord::RecordInvalid => e
    err(
      status: :unprocessable_entity,
      code: 'validation_failed',
      message: e.record.errors.full_messages.join(', ')
    )
  rescue ActiveRecord::RecordNotUnique
    err(status: :conflict, code: 'workspace_exists', message: 'That workspace slug is already taken')
  end

  private

  def err(status:, code:, message:, details: nil)
    payload = { status: status, code: code, message: message }
    payload[:details] = details if details.present?
    { ok: false, error: payload }
  end

  def unique_slug(seed)
    base = seed.to_s.parameterize
    base = "workspace-#{SecureRandom.hex(4)}" if base.blank?
    candidate = base
    suffix = 0
    while Workspace.exists?(slug: candidate)
      suffix += 1
      candidate = "#{base}-#{suffix}"
    end
    candidate
  end
end
