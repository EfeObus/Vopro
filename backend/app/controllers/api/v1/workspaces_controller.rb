module Api
  module V1
    class WorkspacesController < ApplicationController
      before_action :authenticate_user!
      before_action :require_admin!, only: [:update]

      def show
        render json: WorkspaceSerializer.call(current_user.workspace)
      end

      def update
        ws = current_user.workspace
        patch = workspace_settings_params.stringify_keys
        if patch.key?("masking_rules")
          patch["masking_rules"] = Workspace.normalize_masking_rules(patch["masking_rules"])
        end
        ws.settings = (ws.settings || {}).merge(patch)
        ws.save!
        render json: WorkspaceSerializer.call(ws)
      end

      private

      def workspace_settings_params
        raw = params.require(:workspace).require(:settings)
        permitted = raw.permit(
          :auto_generate_sop,
          :event_retention_days,
          :capture_web_enabled,
          :capture_desktop_enabled,
          :capture_terminal_enabled,
          :capture_pause_incognito
        ).to_h
        mr = raw[:masking_rules].presence || raw["masking_rules"].presence
        permitted[:masking_rules] = mr if mr
        permitted
      end

      def require_admin!
        return if current_user.role == "admin"

        render_error(
          status: :forbidden,
          code: "forbidden",
          message: "Admin role required"
        )
      end
    end
  end
end
