module Api
  module V1
    class IntegrationsController < ApplicationController
      before_action :authenticate_user!

      def index
        render json: current_user.workspace.integrations.map { |i| IntegrationSerializer.call(i) }
      end

      def create
        workspace = current_user.workspace
        attrs = integration_params
        provider = attrs[:provider].to_s.presence
        if provider.blank?
          return render_error(status: :bad_request, code: "bad_request", message: "provider is required")
        end

        integration = workspace.integrations.find_or_initialize_by(provider: provider)
        if integration.persisted? && provider != "rest"
          return render_error(
            status: :conflict,
            code: "integration_exists",
            message: "Disconnect the existing #{provider} integration before connecting again."
          )
        end

        was_new = integration.new_record?
        integration.assign_attributes(attrs.except(:provider))
        integration.save!
        audit(was_new ? "integration.create" : "integration.update", integration)
        render json: IntegrationSerializer.call(integration), status: was_new ? :created : :ok
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
        raw = params.require(:integration)
        permitted = raw.permit(:provider, :status)
        permitted[:settings] = coerce_nested_json(raw[:settings]) if raw[:settings].present?
        permitted[:secrets] = coerce_nested_json(raw[:secrets]) if raw[:secrets].present?
        permitted
      end

      def coerce_nested_json(value)
        case value
        when ActionController::Parameters
          value.permit!.to_h
        when Hash
          value.stringify_keys
        else
          {}
        end
      end
    end
  end
end
