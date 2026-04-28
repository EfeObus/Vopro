class WorkspaceSerializer
  def self.call(workspace)
    {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      settings: workspace.merged_settings
    }
  end
end
