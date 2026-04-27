# Vopro AI Engine

Python 3.11 + FastAPI service that:

1. **Detects** repeatable workflows from a stream of captured events
   (frequent-sequence mining over per-user sessions).
2. **Generates** a structured SOP from a sequence of events, with optional
   LLM polish.

## Run

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn vopro_ai.api:app --reload   # http://localhost:8000
```

## Endpoints

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET  | `/health` |  | `{ status, version }` |
| POST | `/detect` | `{ events: [...] }` | `{ candidates: [WorkflowCandidate] }` |
| POST | `/generate` | `{ workflow, events }` | `GenerateResponse` |

## LLM provider

Default is `deterministic` — purely template-based, no API key required, fully
offline. Set `VOPRO_LLM_PROVIDER=openai` and `OPENAI_API_KEY=…` to have step
titles and the description polished by a real LLM. The deterministic provider
is the fallback if the network call fails.

## CLI

```bash
python -m vopro_ai.worker detect events.json
python -m vopro_ai.worker generate events.json
```

## Test

```bash
pytest
ruff check .
```
