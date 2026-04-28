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
          sops: workspace.sops.where(updated_at: day...next_day).count
        }
      end

      runs_last_7d = workspace.workflow_events.where("occurred_at >= ?", 7.days.ago).count
      runs_prev_7d = workspace.workflow_events.where(occurred_at: 14.days.ago..7.days.ago).count
      wow_pct =
        if runs_prev_7d.positive?
          (((runs_last_7d - runs_prev_7d).to_f / runs_prev_7d) * 100).round(1)
        end

      published_updated_week = workspace.sops.where(status: "published").where("updated_at >= ?", 7.days.ago).count
      hours_saved = (saved_minutes / 60.0).round(1)

      {
        sopsTotal: sops_total,
        runsLast30d: runs_30d,
        automationMinutesSaved: saved_minutes,
        activeUsers: active_users,
        runsByDay: runs_by_day,
        bottlenecks: bottlenecks(workspace),
        runsLast7d: runs_last_7d,
        runsPrev7d: runs_prev_7d,
        runsWeekOverWeekPercent: wow_pct,
        publishedSopsUpdatedLast7d: published_updated_week,
        estimatedHoursSaved: hours_saved
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
          avgDurationSec: sop.average_duration_sec.to_i,
          outlierDurationSec: (sop.average_duration_sec.to_i * 2.2).to_i,
          occurrences: sop.runs_observed.to_i
        }
      end
    end
  end
end
