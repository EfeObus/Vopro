module Api
  module V1
    class WorkflowsController < ApplicationController
      before_action :authenticate_user!
      before_action :set_workflow, only: %i[show update generate_sop dismiss]

      def index
        workflows = current_user.workspace.workflows
        workflows = workflows.where(status: params[:status]) if params[:status]
        render json: workflows.order(updated_at: :desc).map { |w| WorkflowSerializer.call(w) }
      end

      def show
        render json: WorkflowSerializer.call(@workflow)
      end

      def update
        @workflow.update!(workflow_params)
        render json: WorkflowSerializer.call(@workflow)
      end

      def generate_sop
        GenerateSopJob.perform_async(@workflow.id)
        render json: { status: "queued" }, status: :accepted
      end

      def dismiss
        @workflow.update!(status: "dismissed")
        render json: WorkflowSerializer.call(@workflow)
      end

      private

      def set_workflow
        @workflow = current_user.workspace.workflows.find(params[:id])
      end

      def workflow_params
        params.require(:workflow).permit(:title, :status)
      end
    end
  end
end
