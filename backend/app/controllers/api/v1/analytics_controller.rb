module Api
  module V1
    class AnalyticsController < ApplicationController
      before_action :authenticate_user!

      def overview
        render json: AnalyticsService.overview(current_user.workspace)
      end

      def bottlenecks
        render json: AnalyticsService.bottlenecks(current_user.workspace)
      end
    end
  end
end
