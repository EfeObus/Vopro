class UserSerializer
  def self.call(user)
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      workspaceId: user.workspace_id
    }
  end
end
