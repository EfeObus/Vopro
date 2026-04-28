"""Decision-branch inference.

Given multiple sessions of the same workflow, find the points where sessions
*fork* — i.e. share a common prefix and then diverge. Those are decision
points that belong in the SOP.

Algorithm:
  1. Project each session into a list of step keys (kind|application|target).
  2. Walk position-by-position. At each position, count which step keys
     appeared at that index across sessions.
  3. If two or more distinct keys have >= MIN_BRANCH_SUPPORT occurrences and
     together cover at least MIN_BRANCH_COVERAGE of all sessions, declare a
     branch point with those branches.
  4. Stop walking once sessions can no longer be aligned (lengths differ
     too much past the branch).

Output is a list of `Branch` records that the SOP generator stitches into
the canonical step list.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from collections.abc import Iterable
from dataclasses import dataclass, field

from .models import Event

MIN_BRANCH_SUPPORT = 2     # at least N sessions must take a branch
MIN_BRANCH_COVERAGE = 0.6  # branches must cover >=60% of sessions combined
MAX_BRANCHES = 4           # cap how many branches per decision


@dataclass
class Branch:
    """One arm of a decision point."""

    label: str
    step_key: str
    occurrences: int
    sample_targets: list[str] = field(default_factory=list)


@dataclass
class DecisionPoint:
    """A position in the canonical sequence where work forks."""

    position: int        # index in the canonical step list (0-based)
    question: str        # human-readable inferred question
    branches: list[Branch]


def _step_key(e: Event) -> str:
    target = (e.target or e.url or "").strip()
    target = re.sub(r"\b\d{4,}\b", "{n}", target)
    target = re.sub(r"\s+", " ", target).lower()[:80]
    return f"{e.kind}|{e.application or ''}|{target}"


def _branch_label(key: str) -> str:
    """Build a short label for a branch from its step key."""
    try:
        kind, app, target = key.split("|", 2)
    except ValueError:
        return key
    if target:
        return target.strip().capitalize()[:60]
    return f"{kind} in {app}".strip()


def _branch_question(prefix_key: str | None, branches: Iterable[Branch]) -> str:
    """Infer a plausible decision question from the prefix and branches."""
    if prefix_key:
        try:
            _, app, target = prefix_key.split("|", 2)
        except ValueError:
            app, target = "", prefix_key
        if target:
            return f"After {target.strip()} in {app or 'the application'}, which path applies?"
    labels = ", ".join(b.label for b in list(branches)[:3])
    return f"Which path applies: {labels}?"


def detect_branches(sessions: list[list[Event]]) -> list[DecisionPoint]:
    """Return ordered decision points across the aligned sessions."""
    if len(sessions) < MIN_BRANCH_SUPPORT:
        return []

    keyed = [[_step_key(e) for e in s] for s in sessions]
    max_len = max(len(s) for s in keyed)

    decisions: list[DecisionPoint] = []
    last_decision_pos = -1

    for pos in range(max_len):
        keys_here = [s[pos] for s in keyed if pos < len(s)]
        if len(keys_here) < MIN_BRANCH_SUPPORT:
            break
        counts = Counter(keys_here)
        # Skip if everyone took the same step — not a branch.
        if len(counts) < 2:
            continue

        viable = [(k, c) for k, c in counts.most_common(MAX_BRANCHES) if c >= MIN_BRANCH_SUPPORT]
        if len(viable) < 2:
            continue

        coverage = sum(c for _, c in viable) / len(keys_here)
        if coverage < MIN_BRANCH_COVERAGE:
            continue

        # Don't emit a decision immediately adjacent to the previous one — it's
        # almost always the tail of the same fork.
        if pos - last_decision_pos < 2:
            continue
        last_decision_pos = pos

        sample_targets: defaultdict[str, list[str]] = defaultdict(list)
        for s in sessions:
            if pos < len(s):
                key = _step_key(s[pos])
                t = s[pos].target or s[pos].url or ""
                if t and len(sample_targets[key]) < 3:
                    sample_targets[key].append(t)

        branches = [
            Branch(
                label=_branch_label(k),
                step_key=k,
                occurrences=c,
                sample_targets=sample_targets[k],
            )
            for k, c in viable
        ]

        prefix_key = keyed[0][pos - 1] if pos > 0 else None
        decisions.append(
            DecisionPoint(
                position=pos,
                question=_branch_question(prefix_key, branches),
                branches=branches,
            )
        )

    return decisions
