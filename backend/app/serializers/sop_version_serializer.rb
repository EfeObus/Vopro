class SopVersionSerializer
  def self.call(version)
    {
      id: version.id,
      version: version.version,
      authoredBy: version.authored_by,
      authoredAt: version.created_at.iso8601,
      summary: version.summary
    }
  end
end
