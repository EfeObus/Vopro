"""Frequent-sequence pattern detection over captured events.

We segment events into "sessions" by user, then look for frequent ordered
n-grams of (kind, application, target_template) tuples. Anything repeating
across sessions and users with sufficient support is surfaced as a workflow
candidate.

This is intentionally lightweight (no scikit-learn dep needed for the MVP) so
it runs fast and is easy to reason about.
"""

from __future__ import annotations

import hashlib
import re
from collections import Counter, defaultdict
from collections.abc import Iterable
from datetime import datetime, timedelta

from .models import Event, WorkflowCandidate

# Tunables
SESSION_GAP = timedelta(minutes=15)
MIN_NGRAM = 3
MAX_NGRAM = 8
MIN_SUPPORT = 3                 # appears in at least N sessions
MIN_DISTINCT_USERS = 1           # at least this many distinct users
TOP_K_CANDIDATES = 25


def _normalize_target(t: str | None) -> str:
    """Replace IDs / numbers / UUIDs with placeholders so similar UIs cluster."""
    if not t:
        return ""
    s = t
    s = re.sub(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", "{uuid}", s)
    s = re.sub(r"\b\d{4,}\b", "{n}", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s.lower()[:120]


def _step_key(e: Event) -> str:
    parts = [e.kind, e.application or "", _normalize_target(e.target or e.url or "")]
    return " | ".join(parts)


def _sessionize(events: Iterable[Event]) -> list[list[Event]]:
    """Group events per user into sessions broken by SESSION_GAP."""
    by_user: dict[str, list[Event]] = defaultdict(list)
    for e in events:
        by_user[e.user_id or "anon"].append(e)

    sessions: list[list[Event]] = []
    for user_events in by_user.values():
        user_events.sort(key=lambda x: x.occurred_at)
        current: list[Event] = []
        last_ts: datetime | None = None
        for e in user_events:
            if last_ts and (e.occurred_at - last_ts) > SESSION_GAP:
                if current:
                    sessions.append(current)
                current = []
            current.append(e)
            last_ts = e.occurred_at
        if current:
            sessions.append(current)
    return sessions


def _ngrams(seq: list[str], n: int) -> list[tuple[str, ...]]:
    return [tuple(seq[i : i + n]) for i in range(len(seq) - n + 1)]


def detect(events: list[Event]) -> list[WorkflowCandidate]:
    sessions = _sessionize(events)
    if not sessions:
        return []

    sequences = [[_step_key(e) for e in sess] for sess in sessions]

    # Count distinct sessions / users / latest occurrence per ngram
    counts: Counter[tuple[str, ...]] = Counter()
    users_per: defaultdict[tuple[str, ...], set[str]] = defaultdict(set)
    last_seen: dict[tuple[str, ...], datetime] = {}
    sample_ids: defaultdict[tuple[str, ...], list[str]] = defaultdict(list)

    for sess, raw in zip(sequences, sessions, strict=False):
        seen_in_session: set[tuple[str, ...]] = set()
        for n in range(MIN_NGRAM, MAX_NGRAM + 1):
            for gram in _ngrams(sess, n):
                if gram in seen_in_session:
                    continue
                seen_in_session.add(gram)
                counts[gram] += 1
                if raw:
                    users_per[gram].add(raw[0].user_id or "anon")
                    last_seen[gram] = max(last_seen.get(gram, raw[0].occurred_at), raw[-1].occurred_at)
                    if len(sample_ids[gram]) < 5:
                        sample_ids[gram].extend([e.id for e in raw if e.id])

    # Keep only the longest distinct gram per family — i.e. drop shorter prefixes
    # that are subsumed by a longer high-support gram.
    grams_sorted = sorted(counts.keys(), key=len, reverse=True)
    kept: list[tuple[str, ...]] = []
    for g in grams_sorted:
        if counts[g] < MIN_SUPPORT:
            continue
        if len(users_per[g]) < MIN_DISTINCT_USERS:
            continue
        if any(_is_subsequence(g, k) for k in kept):
            continue
        kept.append(g)

    candidates: list[WorkflowCandidate] = []
    for g in kept[:TOP_K_CANDIDATES]:
        sig = hashlib.sha256(("|".join(g)).encode()).hexdigest()[:16]
        first_app = next((p.split(" | ")[1] for p in g if " | " in p), None) or None
        title = _make_title(g)
        confidence = min(1.0, 0.4 + 0.05 * counts[g] + 0.05 * len(users_per[g]))
        candidates.append(
            WorkflowCandidate(
                signature=sig,
                title=title,
                application=first_app,
                occurrences=counts[g],
                last_seen=last_seen[g],
                confidence=round(confidence, 3),
                sample_event_ids=sample_ids[g][:5],
            )
        )

    candidates.sort(key=lambda c: (c.confidence, c.occurrences), reverse=True)
    return candidates


def _is_subsequence(short: tuple[str, ...], long: tuple[str, ...]) -> bool:
    if len(short) >= len(long):
        return False
    it = iter(long)
    return all(item in it for item in short)


def _make_title(gram: tuple[str, ...]) -> str:
    """Build a short human title from a step pattern."""
    apps = []
    actions = []
    for step in gram:
        try:
            kind, app, target = tuple(p.strip() for p in step.split(" | ", 2))
        except ValueError:
            continue
        if app and app not in apps:
            apps.append(app)
        if kind and (not actions or actions[-1] != kind):
            actions.append(kind)
        if target and len(actions) <= 2:
            actions.append(target.split()[0] if target else "")

    head = " → ".join(a for a in actions[:3] if a)
    tail = " / ".join(apps[:2])
    if head and tail:
        return f"{head} in {tail}"
    return head or tail or "Repeatable workflow"
