class WorkflowSerializer
  def self.call(workflow)
    {
      id: workflow.id,
      title: workflow.title,
      application: workflow.application,
      occurrences: workflow.occurrences.to_i,
      lastSeen: workflow.last_seen_at&.iso8601,
      confidence: workflow.confidence.to_f,
      status: workflow.status
    }
  end
end
