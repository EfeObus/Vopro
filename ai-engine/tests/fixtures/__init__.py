"""Synthetic but realistic event datasets used to lock in baseline accuracy
for the pattern, decision, and SOP generators.

Each fixture is a callable returning ``(events, expected)`` where ``expected``
is a small dict the baseline test asserts against:

    {
      "min_workflow_occurrences": int,
      "expected_apps": set[str],          # any of these apps must appear
      "expected_decision_labels": set[str] | None,
      "expected_decision_position": int | None,
      "expected_avg_duration_sec_range": (lo, hi) | None,
    }

We keep the data deterministic so failures point at real algorithmic
regressions, not flake.
"""
