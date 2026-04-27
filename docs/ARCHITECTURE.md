# Architecture

## Components

### 1. Desktop Capture Agent (`agent/`)
Electron + TypeScript. Runs locally on the user's machine.

- Hooks into OS-level input where permitted, plus a browser bridge for web apps.
- Buffers events to a local SQLite/JSON store (`~/.vopro/events.jsonl`).
- Applies **on-device PII masking** before any network call.
- Syncs masked events to the backend in batches over HTTPS.
- Provides a tray UI with a clear "capture on/off" indicator.

### 2. Backend API (`backend/`)
Ruby on Rails (API mode), PostgreSQL, Redis, Sidekiq.

Models:
- `User` — auth and access control
- `Workspace` — tenant boundary
- `Workflow` — a detected repeatable process
- `WorkflowEvent` — a single captured action (JSONB payload)
- `Sop` — generated documentation, current version
- `SopVersion` — immutable version history
- `Integration` — third-party connector config

Background jobs:
- `IngestEventBatchJob` — validates and stores incoming batches
- `DetectPatternsJob` — scheduled, calls the AI engine
- `GenerateSopJob` — produces an SOP draft for a detected workflow
- `RefreshSopJob` — checks if an existing SOP needs updating

### 3. AI Engine (`ai-engine/`)
Python 3.11, FastAPI, scikit-learn.

- `pattern.py` — frequent-sequence mining over event streams
- `sop.py` — converts a sequence of events into structured SOP markdown
- `llm.py` — pluggable provider (deterministic templates by default, OpenAI optional)
- `api.py` — FastAPI endpoints called by Sidekiq workers

### 4. Frontend Dashboard (`frontend/`)
React 18 + TypeScript + Vite + Tailwind.

Routes:
- `/` — overview / process intelligence
- `/sops` — SOP library
- `/sops/:id` — SOP detail + editor + version history
- `/workflows` — detected patterns awaiting SOP generation
- `/integrations` — connector setup
- `/settings` — privacy, opt-in, masking rules

### 5. Integrations (`integrations/`)
Thin connector library used by both backend and agent:
- Google Workspace (Drive, Docs, Calendar)
- Microsoft 365 (Graph API)
- Generic REST webhook ingest

## Data flow

```
Agent → POST /api/v1/events (batch)
      → IngestEventBatchJob (Sidekiq) → Postgres
      → DetectPatternsJob (cron)
        → POST ai-engine /detect → returns candidate workflows
        → GenerateSopJob per candidate
          → POST ai-engine /generate → returns SOP markdown + steps
          → Sop + SopVersion persisted
Frontend ← GET /api/v1/sops, /api/v1/workflows, /api/v1/analytics
```

## Privacy boundary

The agent is the **trust boundary**. Anything that crosses the network has
already been through:
1. Masking ruleset (regex + content-type heuristics)
2. User opt-in for the source application
3. Workspace-level retention policy

See [`PRIVACY.md`](PRIVACY.md).
