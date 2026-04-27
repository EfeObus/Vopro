module Api
  module V1
    class IntegrationsController < ApplicationController
      before_action :authenticate_user!

      def index
        render json: current_user.workspace.integrations.map { |i| IntegrationSerializer.call(i) }
      end

      def create
        integration = current_user.workspace.integrations.create!(integration_params)
        render json: IntegrationSerializer.call(integration), status: :created
      end

      def update
        integration = current_user.workspace.integrations.find(params[:id])
        integration.update!(integration_params)
        render json: IntegrationSerializer.call(integration)
      end

      def destroy
        integration = current_user.workspace.integrations.find(params[:id])
        integration.destroy!
        head :no_content
      end

      private

      def integration_params
        params.require(:integration).permit(:provider, :status, settings: {}, secrets: {})
      end
    end
  end
end
