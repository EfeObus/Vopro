module Api
  module V1
    class SopsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_sop, only: %i[show update destroy versions publish archive export]

      def index
        sops = current_user.workspace.sops.includes(:owner).order(updated_at: :desc)
        render json: sops.map { |s| SopSerializer.detail(s) }
      end

      def show
        render json: SopSerializer.detail(@sop)
      end

      def create
        sop = current_user.workspace.sops.create!(sop_params.merge(owner: current_user))
        audit("sop.create", subject_id: sop.id)
        render json: SopSerializer.detail(sop), status: :created
      end

      def update
        @sop.update!(sop_params)
        SopVersion.create!(
          sop: @sop,
          version: @sop.next_version_number,
          authored_by: current_user.name,
          summary: params[:summary] || "Manual edit",
          snapshot: @sop.as_versioned_snapshot
        )
        audit("sop.update", subject_id: @sop.id, metadata: { summary: params[:summary] })
        render json: SopSerializer.detail(@sop)
      end

      def destroy
        sop_id = @sop.id
        @sop.destroy!
        audit("sop.destroy", subject_id: sop_id)
        head :no_content
      end

      def versions
        render json: @sop.sop_versions.order(version: :desc).map { |v| SopVersionSerializer.call(v) }
      end

      def publish
        @sop.update!(status: "published")
        audit("sop.publish", subject_id: @sop.id)
        render json: { status: @sop.status }
      end

      def archive
        @sop.update!(status: "archived")
        audit("sop.archive", subject_id: @sop.id)
        render json: { status: @sop.status }
      end

      def export
        format = params.fetch(:format, "markdown")
        body = SopExporter.call(@sop, format: format.to_sym)
        audit("sop.export", subject_id: @sop.id, metadata: { format: format })

        send_data body,
                  filename: "#{@sop.id}.#{format}",
                  type: format == "pdf" ? "application/pdf" : "text/plain",
                  disposition: "attachment"
      end

      private

      def audit(action, subject_id:, metadata: {})
        AuditLogger.record(
          workspace: current_user.workspace,
          user: current_user,
          action: action,
          subject_type: "Sop",
          subject_id: subject_id,
          metadata: metadata.compact,
          request: request
        )
      end

      def set_sop
        @sop = current_user.workspace.sops.find(params[:id])
      end

      def sop_params
        permitted = params.require(:sop).permit(:title, :description, :status).to_h
        permitted[:tags]  = Array(params[:sop][:tags])  if params[:sop].key?(:tags)
        permitted[:steps] = Array(params[:sop][:steps]) if params[:sop].key?(:steps)
        permitted
      end
    end
  end
end
