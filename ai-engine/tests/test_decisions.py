from datetime import datetime, timedelta

from vopro_ai.decisions import detect_branches
from vopro_ai.models import Event, WorkflowRef
from vopro_ai.sop import generate


def _ev(user, kind, app, target, t):
    return Event(id=f"{user}-{t.isoformat()}", user_id=user, kind=kind, application=app, target=target, occurred_at=t)


def _session(user, base, branch_target):
    return [
        _ev(user, "navigation", "NetSuite", "/ap_queue", base),
        _ev(user, "click", "NetSuite", "Open invoice", base + timedelta(seconds=10)),
        _ev(user, "click", "NetSuite", "Match PO", base + timedelta(seconds=20)),
        _ev(user, branch_target["kind"], branch_target["app"], branch_target["target"],
            base + timedelta(seconds=30)),
        _ev(user, "click", "NetSuite", "Mark complete", base + timedelta(seconds=40)),
    ]


def test_detect_branches_finds_fork():
    """Build sessions where the first three steps are identical and step 4
    forks between two clearly-different actions."""
    base = datetime(2026, 4, 27, 9, 0, 0)
    director_branch = {"kind": "click", "app": "Slack", "target": "Notify Director"}
    self_approve = {"kind": "click", "app": "NetSuite", "target": "Approve"}

    sessions = [
        _session("u1", base + timedelta(minutes=0), director_branch),
        _session("u2", base + timedelta(minutes=30), director_branch),
        _session("u3", base + timedelta(minutes=60), self_approve),
        _session("u4", base + timedelta(minutes=90), self_approve),
    ]

    branches = detect_branches(sessions)
    assert branches, "expected to find at least one decision point"
    first = branches[0]
    assert first.position == 3
    labels = {b.label for b in first.branches}
    assert "Notify director" in labels
    assert "Approve" in labels


def test_no_branches_when_sessions_are_identical():
    base = datetime(2026, 4, 27, 9, 0, 0)
    same = {"kind": "click", "app": "NetSuite", "target": "Approve"}
    sessions = [_session(f"u{i}", base + timedelta(minutes=15 * i), same) for i in range(4)]
    assert detect_branches(sessions) == []


def test_generate_emits_decision_step():
    """End-to-end: events with a fork should produce an SOP that includes
    a decision step."""
    base = datetime(2026, 4, 27, 9, 0, 0)
    director_branch = {"kind": "click", "app": "Slack", "target": "Notify Director"}
    self_approve = {"kind": "click", "app": "NetSuite", "target": "Approve"}
    sessions = [
        _session("u1", base + timedelta(minutes=0), director_branch),
        _session("u2", base + timedelta(minutes=30), director_branch),
        _session("u3", base + timedelta(minutes=60), self_approve),
        _session("u4", base + timedelta(minutes=90), self_approve),
    ]
    events = [e for s in sessions for e in s]
    out = generate(WorkflowRef(title="AP invoice review"), events)

    decision_steps = [s for s in out.steps if s.decision]
    assert decision_steps, "expected a decision step in the SOP"
    branches = decision_steps[0].decision["branches"]
    assert len(branches) >= 2
