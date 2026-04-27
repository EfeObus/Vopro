"""Convert a captured event sequence into a structured SOP."""

from __future__ import annotations

import os
import statistics
from collections import Counter, defaultdict
from datetime import timedelta

from .decisions import DecisionPoint, detect_branches
from .llm import LLM, get_llm
from .models import Event, GenerateResponse, SopStep, WorkflowRef

# Sessions inside a single workflow's event stream are split when the gap
# between consecutive events exceeds this. Anything within is one run.
SESSION_GAP_SEC = 15 * 60


VERB_MAP = {
    "click": "Click",
    "input": "Enter",
    "navigation": "Open",
    "form_submit": "Submit",
    "shortcut": "Use shortcut",
    "copy": "Copy",
    "paste": "Paste",
    "open": "Open",
    "close": "Close",
    "focus": "Focus",
    "blur": "Switch away from",
}


def _humanize(event: Event) -> tuple[str, str]:
    verb = VERB_MAP.get(event.kind, event.kind.title())
    target = event.target or event.url or event.application or "the active element"
    if event.application and event.kind == "navigation":
        return (f"Open {target} in {event.application}", f"Navigate to {target}.")
    return (f"{verb} {target}", f"In {event.application or 'the application'}, {verb.lower()} {target}.")


def _collapse_repeats(events: list[Event]) -> list[Event]:
    out: list[Event] = []
    for e in events:
        if out and out[-1].kind == e.kind and out[-1].target == e.target and out[-1].application == e.application:
            continue
        out.append(e)
    return out


def _split_into_sessions(events: list[Event]) -> list[list[Event]]:
    """Group events into per-user runs, broken by SESSION_GAP_SEC."""
    by_user: dict[str, list[Event]] = defaultdict(list)
    for e in events:
        by_user[e.user_id or "anon"].append(e)

    sessions: list[list[Event]] = []
    for user_events in by_user.values():
        user_events.sort(key=lambda x: x.occurred_at)
        current: list[Event] = []
        last_ts = None
        for e in user_events:
            if last_ts and (e.occurred_at - last_ts).total_seconds() > SESSION_GAP_SEC:
                if current:
                    sessions.append(current)
                current = []
            current.append(e)
            last_ts = e.occurred_at
        if current:
            sessions.append(current)
    return sessions


def _canonical_session(events: list[Event]) -> list[Event]:
    """Pick a representative session from a possibly multi-session stream.

    We prefer the session whose length is the median across runs — this
    avoids over-/under-counting steps when a single user did the workflow
    many times. If everything fits in one session, we return it.
    """
    sessions = _split_into_sessions(events)
    if not sessions:
        return events
    if len(sessions) == 1:
        return sessions[0]
    target_len = int(statistics.median(len(s) for s in sessions))
    sessions.sort(key=lambda s: (abs(len(s) - target_len), -len(s)))
    return sessions[0]


def _average_duration(sessions: list[list[Event]]) -> int:
    durations = [
        (s[-1].occurred_at - s[0].occurred_at).total_seconds()
        for s in sessions
        if len(s) >= 2
    ]
    if not durations:
        return 0
    return int(statistics.mean(durations))


def _tags(events: list[Event]) -> list[str]:
    apps = [e.application for e in events if e.application]
    return list(dict.fromkeys(apps))[:5]


def generate(workflow: WorkflowRef, events: list[Event], llm: LLM | None = None) -> GenerateResponse:
    llm = llm or get_llm(os.environ.get("VOPRO_LLM_PROVIDER", "deterministic"))
    sorted_events = sorted(events, key=lambda e: e.occurred_at)
    sessions = _split_into_sessions(sorted_events)
    canonical = _collapse_repeats(_canonical_session(sorted_events))

    if not canonical:
        return GenerateResponse(
            title=workflow.title or "Empty workflow",
            description="No events available to generate a procedure.",
            tags=[],
            steps=[],
            confidence=0.0,
            average_duration_sec=0,
            contributors=0,
        )

    decisions = detect_branches(sessions)
    steps = _build_steps_with_decisions(canonical, decisions)

    polished = llm.refine(
        title=workflow.title,
        steps=[s.model_dump() for s in steps],
    )

    title = polished.get("title") or workflow.title or "Detected workflow"
    description = polished.get("description") or _autosummary(events, sessions)
    refined_steps = polished.get("steps") or [s.model_dump() for s in steps]

    contributor_ids = {e.user_id for e in events if e.user_id}

    return GenerateResponse(
        title=title,
        description=description,
        tags=_tags(events),
        steps=[SopStep(**s) for s in refined_steps],
        confidence=_confidence(events),
        average_duration_sec=_average_duration(sessions),
        contributors=max(1, len(contributor_ids)),
    )


def _build_steps_with_decisions(
    canonical: list[Event],
    decisions: list[DecisionPoint],
) -> list[SopStep]:
    """Produce the final SopStep list, splicing decision-point steps in
    at the positions discovered by `detect_branches`.

    Decisions are inserted *before* the canonical step at that position so
    the human reader sees the question before the action that depends on it.
    """
    by_position = {d.position: d for d in decisions}
    out: list[SopStep] = []
    counter = 1

    for idx, e in enumerate(canonical):
        if idx in by_position:
            d = by_position[idx]
            out.append(
                SopStep(
                    id=f"s{counter}",
                    order=counter,
                    title="Decide which path to take",
                    description=d.question,
                    application=e.application,
                    decision={
                        "question": d.question,
                        "branches": [
                            {
                                "label": b.label,
                                "occurrences": b.occurrences,
                                "go_to_step_id": f"s{counter + 1 + i}",
                            }
                            for i, b in enumerate(d.branches)
                        ],
                    },
                )
            )
            counter += 1

        title, description = _humanize(e)
        out.append(
            SopStep(
                id=f"s{counter}",
                order=counter,
                title=title,
                description=description,
                application=e.application,
            )
        )
        counter += 1

    return out


def _autosummary(events: list[Event], sessions: list[list[Event]]) -> str:
    apps = Counter(e.application for e in events if e.application)
    top = ", ".join(a for a, _ in apps.most_common(3)) or "various applications"
    duration = _average_duration(sessions)
    if duration:
        td = timedelta(seconds=duration)
        return f"Process spanning {top}. Typical run takes about {td}."
    return f"Process spanning {top}."


def _confidence(events: list[Event]) -> float:
    n = len(events)
    base = min(0.95, 0.5 + 0.01 * n)
    return round(base, 2)
