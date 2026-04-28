class UserSerializer
  def self.call(user)
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      workspaceId: user.workspace_id,
      captureConsentAccepted: user.consented?("workflow_capture_policy_v1")
    }
  end
end
