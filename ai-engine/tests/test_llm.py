import logging

from vopro_ai.llm import DeterministicLLM, OpenAILLM, get_llm


def test_deterministic_returns_inputs_unchanged():
    out = DeterministicLLM().refine(title="t", steps=[{"id": "s1"}])
    assert out["title"] == "t"
    assert out["steps"] == [{"id": "s1"}]
    assert out["meta"]["llm_provider"] == "deterministic"
    assert out["meta"]["llm_fallback"] is False


def test_openai_falls_back_when_key_missing(monkeypatch, caplog):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with caplog.at_level(logging.WARNING, logger="vopro.llm"):
        out = OpenAILLM().refine(title="t", steps=[])
    assert out["meta"]["llm_fallback"] is True
    assert out["meta"]["reason"] == "missing_api_key"
    assert any("missing_key" in m for m in caplog.messages)


def test_openai_logs_and_falls_back_on_http_error(monkeypatch, caplog):
    import httpx

    class _Resp:
        status_code = 500
        text = "boom"

        def raise_for_status(self):
            raise httpx.HTTPStatusError("server error", request=None, response=self)

    def _post(*_args, **_kwargs):
        return _Resp()

    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setattr(httpx, "post", _post)

    with caplog.at_level(logging.WARNING, logger="vopro.llm"):
        out = OpenAILLM().refine(title="t", steps=[{"id": "s1"}])

    assert out["meta"]["llm_fallback"] is True
    assert out["meta"]["reason"].startswith("http_")
    assert any("openai_llm_http_error" in m for m in caplog.messages)


def test_get_llm_picks_provider():
    assert isinstance(get_llm("deterministic"), DeterministicLLM)
    assert isinstance(get_llm("openai"), OpenAILLM)
    assert isinstance(get_llm("unknown"), DeterministicLLM)
