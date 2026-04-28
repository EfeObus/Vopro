"""Pluggable LLM provider.

Default is the deterministic provider, which simply returns the structured
input unchanged. Set VOPRO_LLM_PROVIDER=openai (and OPENAI_API_KEY) to use
a real LLM. In that case, the `refine` method asks the model to clean up
step titles and produce a one-paragraph description.

When the OpenAI call fails, we always log the failure and fall back to the
deterministic refiner. The fallback flag is recorded on the response under
``meta.llm_fallback`` so callers can observe quality regressions in their
metrics pipeline rather than discovering them later in the logs.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Protocol

logger = logging.getLogger("vopro.llm")


class LLM(Protocol):
    def refine(self, *, title: str | None, steps: list[dict[str, Any]]) -> dict[str, Any]:
        ...


def _deterministic(title: str | None, steps: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "title": title,
        "steps": steps,
        "description": None,
        "meta": {"llm_provider": "deterministic", "llm_fallback": False},
    }


class DeterministicLLM:
    """Offline-friendly default. Returns the inputs as-is."""

    def refine(self, *, title: str | None, steps: list[dict[str, Any]]) -> dict[str, Any]:
        return _deterministic(title, steps)


class OpenAILLM:
    """Lightweight wrapper using the OpenAI HTTP API. Requires OPENAI_API_KEY."""

    def __init__(self, model: str | None = None) -> None:
        self.model = model or os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        self.api_key = os.environ.get("OPENAI_API_KEY")

    def refine(self, *, title: str | None, steps: list[dict[str, Any]]) -> dict[str, Any]:
        if not self.api_key:
            logger.warning("openai_llm_missing_key — falling back to deterministic refiner")
            out = _deterministic(title, steps)
            out["meta"] = {"llm_provider": "openai", "llm_fallback": True, "reason": "missing_api_key"}
            return out

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
            parsed = json.loads(content)
            parsed.setdefault("meta", {})
            parsed["meta"].update({"llm_provider": "openai", "llm_fallback": False, "model": self.model})
            return parsed
        except httpx.HTTPStatusError as exc:
            logger.warning(
                "openai_llm_http_error status=%s body=%s",
                exc.response.status_code,
                exc.response.text[:500],
            )
            reason = f"http_{exc.response.status_code}"
        except httpx.RequestError as exc:
            logger.warning("openai_llm_request_error error=%s", exc)
            reason = "request_error"
        except (KeyError, ValueError, json.JSONDecodeError) as exc:
            logger.warning("openai_llm_malformed_response error=%s", exc)
            reason = "malformed_response"
        except Exception as exc:  # noqa: BLE001 — final safety net so the worker stays up.
            logger.exception("openai_llm_unexpected_error error=%s", exc)
            reason = "unexpected"

        out = _deterministic(title, steps)
        out["meta"] = {"llm_provider": "openai", "llm_fallback": True, "reason": reason, "model": self.model}
        return out


def get_llm(provider: str) -> LLM:
    if provider == "openai":
        return OpenAILLM()
    return DeterministicLLM()
