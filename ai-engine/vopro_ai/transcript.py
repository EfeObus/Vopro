"""Structured SOP generation from a spoken call transcript (support, ops, sales)."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

import httpx

from .models import GenerateResponse, SopStep

logger = logging.getLogger(__name__)


def _deterministic(transcript: str, title_hint: str | None) -> GenerateResponse:
    text = transcript.strip()
    if not text:
        return GenerateResponse(
            title=title_hint or "Empty transcript",
            description="No transcript text was provided.",
            tags=["call_transcript"],
            steps=[],
            confidence=0.0,
            average_duration_sec=0,
            contributors=1,
        )

    chunks = [c.strip() for c in re.split(r"\n+|(?<=[.!?])\s+", text) if c.strip()]
    chunks = chunks[:40]

    steps: list[SopStep] = []
    for i, chunk in enumerate(chunks, start=1):
        title = chunk[:120] + ("…" if len(chunk) > 120 else "")
        steps.append(
            SopStep(
                id=f"s{i}",
                order=i,
                title=title,
                description=chunk,
                application=None,
            )
        )

    title = (title_hint or chunks[0][:80]) if chunks else "Call procedure"
    desc = (
        "Procedure derived from a voice transcript. "
        "Review for accuracy and remove customer-specific details before publishing."
    )
    tags = ["call_transcript", "voice"]
    return GenerateResponse(
        title=title[:300],
        description=desc,
        tags=tags,
        steps=steps,
        confidence=min(0.85, 0.45 + 0.015 * len(steps)),
        average_duration_sec=max(30, len(text) // 22),
        contributors=1,
    )


def _openai_structure(transcript: str, title_hint: str | None) -> dict[str, Any]:
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("missing OPENAI_API_KEY")

    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
    sys_msg = (
        "You turn phone-call or meeting transcripts into an internal standard operating procedure. "
        "Steps must reflect what was actually said; merge filler and small talk. "
        "Return strict JSON with keys: title (string), description (string), "
        "steps (array of objects with title, description, optional application string), "
        "tags (array of short strings). Include tag call_transcript."
    )
    user_payload = {"transcript": transcript, "title_hint": title_hint}
    body = {
        "model": model,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": sys_msg},
            {"role": "user", "content": json.dumps(user_payload)},
        ],
    }
    r = httpx.post(
        "https://api.openai.com/v1/chat/completions",
        json=body,
        headers={"Authorization": f"Bearer {api_key}"},
        timeout=90.0,
    )
    r.raise_for_status()
    content = r.json()["choices"][0]["message"]["content"]
    return json.loads(content)


def generate_from_transcript(transcript: str, title_hint: str | None = None) -> GenerateResponse:
    transcript = transcript.strip()
    if not transcript:
        return _deterministic("", title_hint)

    provider = os.environ.get("VOPRO_LLM_PROVIDER", "deterministic")
    if provider == "openai":
        try:
            raw = _openai_structure(transcript, title_hint)
            steps_in = raw.get("steps") or []
            steps: list[SopStep] = []
            for i, row in enumerate(steps_in, start=1):
                if not isinstance(row, dict):
                    continue
                steps.append(
                    SopStep(
                        id=f"s{i}",
                        order=i,
                        title=str(row.get("title") or f"Step {i}")[:200],
                        description=str(row.get("description") or "")[:2000],
                        application=row.get("application"),
                    )
                )
            base_tags = ["call_transcript", "voice"]
            extra = [str(t) for t in (raw.get("tags") or []) if t]
            tags = list(dict.fromkeys(base_tags + extra))[:12]
            return GenerateResponse(
                title=str(raw.get("title") or title_hint or "Call procedure")[:300],
                description=str(raw.get("description") or "")[:5000],
                tags=tags,
                steps=steps,
                confidence=0.82 if steps else 0.42,
                average_duration_sec=max(30, len(transcript) // 22),
                contributors=1,
            )
        except Exception as exc:  # noqa: BLE001 — fallback for any provider failure
            logger.warning("transcript_openai_failed: %s", exc)
            return _deterministic(transcript, title_hint)

    return _deterministic(transcript, title_hint)
