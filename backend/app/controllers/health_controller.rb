class HealthController < ApplicationController
  def show
    render json: {
      status: "ok",
      service: "vopro-backend",
      version: ENV.fetch("VOPRO_VERSION", "0.1.0"),
      time: Time.current.iso8601
    }
  end
end
