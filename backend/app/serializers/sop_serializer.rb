class SopSerializer
  def self.detail(sop)
    {
      id: sop.id,
      title: sop.title,
      description: sop.description,
      status: sop.status,
      tags: Array(sop.tags),
      steps: Array(sop.steps).map { |s| camelize_step(s) },
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

  # Steps are stored as JSONB written by the AI engine (Python) and the seed
  # data, both of which use snake_case keys. The public contract is camelCase
  # though (see `frontend/src/types/index.ts` and `docs/API.md`), so we
  # normalise at the API edge instead of forcing the writers to change style.
  def self.camelize_step(step)
    return step unless step.is_a?(Hash) || step.is_a?(ActionController::Parameters)

    h = step.respond_to?(:to_unsafe_h) ? step.to_unsafe_h : step.to_h
    h = h.deep_transform_keys { |k| k.to_s.camelize(:lower) }
    if (decision = h["decision"]).is_a?(Hash)
      decision["branches"] = Array(decision["branches"]).map do |branch|
        branch.is_a?(Hash) ? branch.deep_transform_keys { |k| k.to_s.camelize(:lower) } : branch
      end
      h["decision"] = decision
    end
    h
  end
end
