Rails.application.configure do
  config.lograge.enabled = !Rails.env.test?
  config.lograge.formatter = Lograge::Formatters::Json.new
  config.lograge.base_controller_class = "ActionController::API"

  config.lograge.custom_options = lambda do |event|
    payload = event.payload
    {
      time: Time.current.iso8601,
      request_id: payload[:request_id] || payload.dig(:headers, "action_dispatch.request_id"),
      user_id: payload[:user_id],
      workspace_id: payload[:workspace_id],
      params: payload[:params].except(*%w[controller action format password authenticity_token]),
      remote_ip: payload[:remote_ip]
    }.compact
  end
end
