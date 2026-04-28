module Api
  module V1
    class IntegrationsController < ApplicationController
      before_action :authenticate_user!

      def index
        render json: current_user.workspace.integrations.map { |i| IntegrationSerializer.call(i) }
      end

      def create
        integration = current_user.workspace.integrations.create!(integration_params)
        audit("integration.create", integration)
        render json: IntegrationSerializer.call(integration), status: :created
      end

      def update
        integration = current_user.workspace.integrations.find(params[:id])
        integration.update!(integration_params)
        audit("integration.update", integration, metadata: { keys: integration_params.keys })
        render json: IntegrationSerializer.call(integration)
      end

      def destroy
        integration = current_user.workspace.integrations.find(params[:id])
        provider = integration.provider
        integration.destroy!
        AuditLogger.record(
          workspace: current_user.workspace,
          user: current_user,
          action: "integration.disconnect",
          subject_type: "Integration",
          subject_id: integration.id,
          metadata: { provider: provider },
          request: request
        )
        head :no_content
      end

      private

      def audit(action, integration, metadata: {})
        AuditLogger.record(
          workspace: current_user.workspace,
          user: current_user,
          action: action,
          subject_type: "Integration",
          subject_id: integration.id,
          metadata: metadata.merge(provider: integration.provider).compact,
          request: request
        )
      end

      def integration_params
        params.require(:integration).permit(:provider, :status, settings: {}, secrets: {})
      end
    end
  end
end
