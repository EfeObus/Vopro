"""Optional CLI entrypoint for local experiments."""

from __future__ import annotations

import json
import sys
from datetime import datetime

from .models import Event, WorkflowRef
from .pattern import detect
from .sop import generate


def _load_events(path: str) -> list[Event]:
    with open(path) as f:
        raw = json.load(f)
    out: list[Event] = []
    for r in raw:
        out.append(
            Event(
                id=r.get("id"),
                user_id=r.get("user_id"),
                kind=r["kind"],
                application=r.get("application"),
                url=r.get("url"),
                target=r.get("target"),
                occurred_at=datetime.fromisoformat(r["occurred_at"].replace("Z", "+00:00")),
            )
        )
    return out


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: python -m vopro_ai.worker [detect|generate] events.json")
        raise SystemExit(2)

    mode, path = sys.argv[1], sys.argv[2]
    events = _load_events(path)

    if mode == "detect":
        print(json.dumps([c.model_dump(mode="json") for c in detect(events)], indent=2, default=str))
    elif mode == "generate":
        wf = WorkflowRef(title="CLI workflow")
        print(generate(wf, events).model_dump_json(indent=2))
    else:
        print("Unknown mode:", mode)
        raise SystemExit(2)


if __name__ == "__main__":
    main()
