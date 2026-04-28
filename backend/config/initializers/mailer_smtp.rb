# frozen_string_literal: true

# Optional outbound SMTP (e.g. Gmail app password). Set SMTP_* in `.env`.

unless Rails.env.test?
  smtp_address = ENV['SMTP_ADDRESS'].presence
  if smtp_address
    Rails.application.config.action_mailer.delivery_method = :smtp
    Rails.application.config.action_mailer.perform_deliveries = true
    Rails.application.config.action_mailer.raise_delivery_errors = Rails.env.development?

    Rails.application.config.action_mailer.smtp_settings = {
      address: smtp_address,
      port: ENV.fetch('SMTP_PORT', '587').to_i,
      user_name: ENV.fetch('SMTP_USERNAME'),
      password: ENV.fetch('SMTP_PASSWORD'),
      authentication: ENV.fetch('SMTP_AUTHENTICATION', 'plain').to_sym,
      enable_starttls_auto: ActiveModel::Type::Boolean.new.cast(
        ENV.fetch('SMTP_ENABLE_STARTTLS', 'true')
      ),
      openssl_verify_mode: OpenSSL::SSL::VERIFY_PEER
    }
  end
end
