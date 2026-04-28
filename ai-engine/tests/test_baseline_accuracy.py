"""Baseline accuracy harness.

Locks in measurable quality bars for the pattern, decision, and SOP
generators against a small library of hand-labeled fixtures. If a code
change drops below the bars below, CI fails.

Bars are intentionally loose enough to absorb non-regression algorithmic
tweaks, but tight enough to catch real quality regressions:

  * pattern.detect must surface at least one candidate per fixture
    that names one of the expected applications.
  * decisions.detect_branches must place a branch at the labeled position
    with all expected labels, when the fixture has a branch.
  * sop.generate must produce non-empty steps, a duration in the
    fixture's plausibility window, and contributor count >= ground truth.
"""

from __future__ import annotations

import pytest

from tests.fixtures.datasets import (  # noqa: F401  (FixtureExpectation re-exported for clarity)
    ALL_FIXTURES,
    FixtureExpectation,
)
from vopro_ai.decisions import detect_branches
from vopro_ai.models import WorkflowRef
from vopro_ai.pattern import detect
from vopro_ai.sop import _split_into_sessions, generate


@pytest.mark.parametrize("fixture", ALL_FIXTURES, ids=lambda f: f.__name__)
def test_pattern_detector_recovers_workflow(fixture):
    events, expected = fixture()
    candidates = detect(events)
    assert candidates, f"{expected.name}: expected at least one candidate"

    # Top candidate's primary app must be one of the expected apps.
    top = candidates[0]
    assert top.application in expected.expected_apps, (
        f"{expected.name}: top candidate app={top.application!r} "
        f"not in expected {expected.expected_apps}"
    )

    # Occurrence and confidence floors guard against silent regressions.
    assert top.occurrences >= expected.min_workflow_occurrences, (
        f"{expected.name}: occurrences={top.occurrences} "
        f"below min {expected.min_workflow_occurrences}"
    )
    assert top.confidence >= 0.5, f"{expected.name}: low confidence {top.confidence}"


@pytest.mark.parametrize("fixture", ALL_FIXTURES, ids=lambda f: f.__name__)
def test_decision_detector_matches_ground_truth(fixture):
    events, expected = fixture()
    sessions = _split_into_sessions(events)
    branches = detect_branches(sessions)

    if expected.expected_decision_labels is None:
        assert branches == [], (
            f"{expected.name}: unexpected branches {branches!r}"
        )
        return

    assert branches, f"{expected.name}: expected a decision point"
    matched = next(
        (d for d in branches if d.position == expected.expected_decision_position),
        None,
    )
    assert matched is not None, (
        f"{expected.name}: no decision at position "
        f"{expected.expected_decision_position} (got {[b.position for b in branches]})"
    )
    found_labels = {b.label for b in matched.branches}
    missing = expected.expected_decision_labels - found_labels
    assert not missing, (
        f"{expected.name}: missing branch labels {missing} (found {found_labels})"
    )


@pytest.mark.parametrize("fixture", ALL_FIXTURES, ids=lambda f: f.__name__)
def test_sop_generator_produces_baseline_quality(fixture):
    events, expected = fixture()
    out = generate(WorkflowRef(title=expected.name.replace("_", " ").title()), events)

    assert out.steps, f"{expected.name}: SOP generator produced no steps"
    assert out.contributors >= expected.min_distinct_contributors, (
        f"{expected.name}: contributors={out.contributors} "
        f"below {expected.min_distinct_contributors}"
    )
    assert 0.0 < out.confidence <= 1.0

    if expected.expected_avg_duration_sec_range:
        lo, hi = expected.expected_avg_duration_sec_range
        assert lo <= out.average_duration_sec <= hi, (
            f"{expected.name}: avg_duration={out.average_duration_sec}s "
            f"outside [{lo}, {hi}]"
        )

    # Tags cover at least the primary app from the fixture.
    assert any(app in out.tags for app in expected.expected_apps), (
            f"{expected.name}: tags={out.tags} miss expected apps {expected.expected_apps}"
    )

    # Decision steps are emitted when the fixture has a labeled branch.
    decision_steps = [s for s in out.steps if s.decision]
    if expected.expected_decision_labels is None:
        assert not decision_steps, (
            f"{expected.name}: unexpected decision step in SOP"
        )
    else:
        assert decision_steps, f"{expected.name}: expected a decision step in SOP"
        labels = {b["label"] for b in decision_steps[0].decision["branches"]}
        missing = expected.expected_decision_labels - labels
        assert not missing, (
            f"{expected.name}: SOP missing decision labels {missing} (got {labels})"
        )


def test_baseline_summary_smoke():
    """Cross-fixture sanity: every fixture is evaluable end-to-end and we
    record an aggregate pass/fail metric. Provides one-line CI signal."""
    failures: list[tuple[str, str]] = []
    for fixture in ALL_FIXTURES:
        events, expected = fixture()
        try:
            assert detect(events), "pattern"
            sessions = _split_into_sessions(events)
            if expected.expected_decision_labels:
                assert detect_branches(sessions), "decisions"
            sop = generate(WorkflowRef(title=expected.name), events)
            assert sop.steps, "sop"
        except AssertionError as exc:  # pragma: no cover - aggregator path
            failures.append((expected.name, str(exc)))

    assert not failures, f"baseline failures: {failures}"
