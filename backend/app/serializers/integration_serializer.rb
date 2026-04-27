class IntegrationSerializer
  def self.call(integration)
    {
      id: integration.id,
      provider: integration.provider,
      status: integration.status,
      settings: integration.settings || {},
      createdAt: integration.created_at.iso8601
    }
  end
end
