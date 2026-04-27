"""Pluggable LLM provider.

Default is the deterministic provider, which simply returns the structured
input unchanged. Set VOPRO_LLM_PROVIDER=openai (and OPENAI_API_KEY) to use
a real LLM. In that case, the `refine` method asks the model to clean up
step titles and produce a one-paragraph description.
"""

from __future__ import annotations

import json
import os
from typing import Any, Protocol


class LLM(Protocol):
    def refine(self, *, title: str | None, steps: list[dict[str, Any]]) -> dict[str, Any]:
        ...


class DeterministicLLM:
    """Offline-friendly default. Returns the inputs as-is."""

    def refine(self, *, title: str | None, steps: list[dict[str, Any]]) -> dict[str, Any]:
        return {"title": title, "steps": steps, "description": None}


class OpenAILLM:
    """Lightweight wrapper using the OpenAI HTTP API. Requires OPENAI_API_KEY."""

    def __init__(self, model: str = "gpt-4o-mini") -> None:
        self.model = model
        self.api_key = os.environ.get("OPENAI_API_KEY")

    def refine(self, *, title: str | None, steps: list[dict[str, Any]]) -> dict[str, Any]:
        if not self.api_key:
            return DeterministicLLM().refine(title=title, steps=steps)

        import httpx

        prompt = (
            "You are turning observed user actions into a clear SOP. "
            "Rewrite step titles to be imperative and concise. Do not invent steps. "
            "Return JSON with keys: title, description (one paragraph), steps "
            "(same shape, possibly improved title/description fields)."
        )
        body = {
            "model": self.model,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": json.dumps({"title": title, "steps": steps})},
            ],
        }
        try:
            resp = httpx.post(
                "https://api.openai.com/v1/chat/completions",
                json=body,
                headers={"Authorization": f"Bearer {self.api_key}"},
                timeout=30,
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            return json.loads(content)
        except Exception:
            return DeterministicLLM().refine(title=title, steps=steps)


def get_llm(provider: str) -> LLM:
    if provider == "openai":
        return OpenAILLM()
    return DeterministicLLM()
