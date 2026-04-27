from datetime import datetime, timedelta

from vopro_ai.models import Event, WorkflowRef
from vopro_ai.sop import generate


def test_generates_steps_with_human_titles():
    base = datetime(2026, 4, 27, 9, 0, 0)
    events = [
        Event(id="1", user_id="u", kind="navigation", application="Zendesk", url="/tickets", occurred_at=base),
        Event(id="2", user_id="u", kind="click", application="Zendesk", target="Apply T1 macro", occurred_at=base + timedelta(seconds=10)),
        Event(id="3", user_id="u", kind="form_submit", application="Zendesk", target="Reply", occurred_at=base + timedelta(seconds=20)),
    ]
    out = generate(WorkflowRef(title="Triage ticket"), events)
    assert out.title
    assert out.steps
    titles = [s.title for s in out.steps]
    assert any("Zendesk" in t or "macro" in t.lower() or "tickets" in t.lower() for t in titles)
    assert out.average_duration_sec == 20
    assert out.contributors == 1


def test_handles_empty_events():
    out = generate(WorkflowRef(title="Empty"), [])
    assert out.steps == []
    assert out.confidence == 0.0
