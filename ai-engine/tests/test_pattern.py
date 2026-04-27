from datetime import datetime, timedelta

from vopro_ai.models import Event
from vopro_ai.pattern import detect


def _e(user, kind, app, target, t):
    return Event(
        id=f"{user}-{t.isoformat()}",
        user_id=user,
        kind=kind,
        application=app,
        target=target,
        occurred_at=t,
    )


def test_detects_repeated_sequence_across_users():
    base = datetime(2026, 4, 27, 10, 0, 0)

    def session(user, offset_minutes):
        t = base + timedelta(minutes=offset_minutes)
        return [
            _e(user, "navigation", "Salesforce", "/opportunities", t),
            _e(user, "click", "Salesforce", "Convert", t + timedelta(seconds=5)),
            _e(user, "input", "Gmail", "compose welcome", t + timedelta(seconds=10)),
            _e(user, "click", "Gmail", "Send", t + timedelta(seconds=15)),
        ]

    events = (
        session("alice", 0)
        + session("alice", 60)
        + session("bob", 120)
        + session("carol", 180)
    )
    candidates = detect(events)
    assert candidates, "expected at least one candidate"
    top = candidates[0]
    assert top.occurrences >= 3
    assert top.confidence >= 0.5
    assert top.application in {"Salesforce", "Gmail"}


def test_returns_empty_on_no_events():
    assert detect([]) == []
