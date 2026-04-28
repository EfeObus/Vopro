"""Hand-crafted event datasets that approximate real-world workflows.

Every dataset is built programmatically (rather than checked in as JSON) so
that the tests stay self-contained and we can assert on object identity,
deterministic ordering, and time arithmetic without parsing overhead.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from vopro_ai.models import Event


@dataclass
class FixtureExpectation:
    """Ground-truth labels we expect the engine to recover."""

    name: str
    min_workflow_occurrences: int
    expected_apps: set[str]
    expected_decision_labels: set[str] | None
    expected_decision_position: int | None
    expected_avg_duration_sec_range: tuple[int, int] | None
    min_distinct_contributors: int


def _e(user: str, kind: str, app: str, target: str, t: datetime, eid: str | None = None) -> Event:
    return Event(
        id=eid or f"{user}-{int(t.timestamp())}",
        user_id=user,
        kind=kind,
        application=app,
        target=target,
        occurred_at=t,
    )


# ---------------------------------------------------------------------------
# Fixture 1: Support-ticket triage in Zendesk (no branching)
# ---------------------------------------------------------------------------

def support_ticket_triage() -> tuple[list[Event], FixtureExpectation]:
    base = datetime(2026, 4, 27, 9, 0, 0)
    events: list[Event] = []
    users = ["alice", "bob", "carol", "dave"]
    for i, user in enumerate(users):
        # 4 sessions of identical work — strong baseline signal.
        t = base + timedelta(minutes=i * 30)
        events += [
            _e(user, "navigation", "Zendesk", "/tickets", t),
            _e(user, "click", "Zendesk", "Open ticket", t + timedelta(seconds=8)),
            _e(user, "click", "Zendesk", "Apply T1 macro", t + timedelta(seconds=22)),
            _e(user, "input", "Zendesk", "Reply body", t + timedelta(seconds=55)),
            _e(user, "form_submit", "Zendesk", "Send reply", t + timedelta(seconds=78)),
        ]

    expected = FixtureExpectation(
        name="support_ticket_triage",
        min_workflow_occurrences=3,
        expected_apps={"Zendesk"},
        expected_decision_labels=None,
        expected_decision_position=None,
        expected_avg_duration_sec_range=(60, 120),
        min_distinct_contributors=4,
    )
    return events, expected


# ---------------------------------------------------------------------------
# Fixture 2: AP invoice review in NetSuite — forks at step 4
# ---------------------------------------------------------------------------

def invoice_approval_with_branch() -> tuple[list[Event], FixtureExpectation]:
    base = datetime(2026, 4, 27, 11, 0, 0)
    director = {"kind": "click", "app": "Slack", "target": "Notify Director"}
    self_approve = {"kind": "click", "app": "NetSuite", "target": "Approve"}

    def session(user: str, offset_min: int, branch: dict) -> list[Event]:
        t = base + timedelta(minutes=offset_min)
        return [
            _e(user, "navigation", "NetSuite", "/ap_queue", t),
            _e(user, "click", "NetSuite", "Open invoice", t + timedelta(seconds=12)),
            _e(user, "click", "NetSuite", "Match PO", t + timedelta(seconds=30)),
            _e(user, branch["kind"], branch["app"], branch["target"], t + timedelta(seconds=55)),
            _e(user, "click", "NetSuite", "Mark complete", t + timedelta(seconds=80)),
        ]

    events = (
        session("u1", 0, director)
        + session("u2", 30, director)
        + session("u3", 60, self_approve)
        + session("u4", 90, self_approve)
    )

    expected = FixtureExpectation(
        name="invoice_approval_with_branch",
        min_workflow_occurrences=2,
        expected_apps={"NetSuite", "Slack"},
        expected_decision_labels={"Notify director", "Approve"},
        expected_decision_position=3,
        expected_avg_duration_sec_range=(60, 120),
        min_distinct_contributors=4,
    )
    return events, expected


# ---------------------------------------------------------------------------
# Fixture 3: CRM lead handoff (Salesforce → Gmail)
# ---------------------------------------------------------------------------

def crm_lead_handoff() -> tuple[list[Event], FixtureExpectation]:
    base = datetime(2026, 4, 27, 13, 0, 0)
    events: list[Event] = []
    for i, user in enumerate(["sam", "ravi", "jo"]):
        t = base + timedelta(minutes=i * 20)
        events += [
            _e(user, "navigation", "Salesforce", "/leads/123", t),
            _e(user, "click", "Salesforce", "Convert", t + timedelta(seconds=14)),
            _e(user, "input", "Gmail", "Compose welcome", t + timedelta(seconds=40)),
            _e(user, "click", "Gmail", "Send", t + timedelta(seconds=60)),
        ]

    expected = FixtureExpectation(
        name="crm_lead_handoff",
        min_workflow_occurrences=3,
        expected_apps={"Salesforce", "Gmail"},
        expected_decision_labels=None,
        expected_decision_position=None,
        expected_avg_duration_sec_range=(45, 90),
        min_distinct_contributors=3,
    )
    return events, expected


ALL_FIXTURES = [
    support_ticket_triage,
    invoice_approval_with_branch,
    crm_lead_handoff,
]
