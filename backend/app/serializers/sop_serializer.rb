class SopSerializer
  def self.detail(sop)
    {
      id: sop.id,
      title: sop.title,
      description: sop.description,
      status: sop.status,
      tags: Array(sop.tags),
      steps: Array(sop.steps),
      ownerName: sop.owner&.name,
      ownerInitials: sop.owner ? sop.owner.name.split.map(&:first).first(2).join : "VO",
      contributors: sop.contributors.to_i,
      runsObserved: sop.runs_observed.to_i,
      averageDurationSec: sop.average_duration_sec.to_i,
      confidence: sop.confidence.to_f,
      lastUpdated: sop.updated_at.iso8601,
      versions: sop.sop_versions.order(version: :desc).map { |v| SopVersionSerializer.call(v) }
    }
  end
end
