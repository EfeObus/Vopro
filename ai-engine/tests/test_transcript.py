"""Transcript → SOP deterministic path."""

import os

from vopro_ai.transcript import generate_from_transcript


def test_generate_from_transcript_deterministic():
    os.environ["VOPRO_LLM_PROVIDER"] = "deterministic"
    r = generate_from_transcript("First step here. Second step there.", "Refund policy")
    assert r.title
    assert len(r.steps) >= 1
    assert "call_transcript" in r.tags


def test_empty_transcript():
    os.environ["VOPRO_LLM_PROVIDER"] = "deterministic"
    r = generate_from_transcript("", None)
    assert r.steps == []
