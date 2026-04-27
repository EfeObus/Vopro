"""Pydantic models for the public API surface."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class Event(BaseModel):
    id: str | None = None
    user_id: str | None = None
    kind: str
    application: str | None = None
    url: str | None = None
    target: str | None = None
    occurred_at: datetime


class DetectRequest(BaseModel):
    events: list[Event]


class WorkflowCandidate(BaseModel):
    signature: str
    title: str
    application: str | None = None
    occurrences: int
    last_seen: datetime
    confidence: float
    sample_event_ids: list[str] = Field(default_factory=list)


class DetectResponse(BaseModel):
    candidates: list[WorkflowCandidate]


class WorkflowRef(BaseModel):
    id: str | int | None = None
    title: str
    application: str | None = None


class GenerateRequest(BaseModel):
    workflow: WorkflowRef
    events: list[Event]


class SopStep(BaseModel):
    id: str
    order: int
    title: str
    description: str
    application: str | None = None
    decision: dict[str, Any] | None = None


class GenerateResponse(BaseModel):
    title: str
    description: str
    tags: list[str]
    steps: list[SopStep]
    confidence: float
    average_duration_sec: int
    contributors: int
