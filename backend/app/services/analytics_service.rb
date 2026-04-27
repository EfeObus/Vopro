class AnalyticsService
  class << self
    def overview(workspace)
      now = Time.current
      thirty_days_ago = now - 30.days

      runs_30d = workspace.workflow_events.where("occurred_at >= ?", thirty_days_ago).count
      sops_total = workspace.sops.count

      # Rough automation savings estimate: each captured event represents
      # a step the user no longer has to recall, ~30 seconds saved.
      saved_minutes = (runs_30d * 30) / 60

      active_users = workspace.workflow_events
                              .where("occurred_at >= ?", thirty_days_ago)
                              .distinct
                              .count(:user_id)

      runs_by_day = (0..6).to_a.reverse.map do |days_ago|
        day = now.beginning_of_day - days_ago.days
        next_day = day + 1.day
        {
          date: day.iso8601,
          label: day.strftime("%a"),
          runs: workspace.workflow_events.where(occurred_at: day...next_day).count,
          sops: workspace.sops.where("updated_at < ?", next_day).count
        }
      end

      {
        sops_total: sops_total,
        runs_last_30d: runs_30d,
        automation_minutes_saved: saved_minutes,
        active_users: active_users,
        activity: runs_by_day,
        # Backwards-compatible alias for the older frontend chart.
        runs_by_day: runs_by_day,
        bottlenecks: bottlenecks(workspace)
      }
    end

    def bottlenecks(workspace)
      workspace.sops
               .where(status: %w[published needs_review])
               .order(average_duration_sec: :desc)
               .limit(10)
               .map do |sop|
        {
          workflow: sop.title,
          avg_duration_sec: sop.average_duration_sec,
          outlier_duration_sec: (sop.average_duration_sec.to_i * 2.2).to_i,
          occurrences: sop.runs_observed.to_i
        }
      end
    end
  end
end
