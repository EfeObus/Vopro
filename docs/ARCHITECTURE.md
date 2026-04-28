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
- `CallRecording` — uploaded call audio metadata, transcript, link to generated **Sop** (when completed)

Background jobs:
- `IngestEventBatchJob` — validates and stores incoming batches
- `DetectPatternsJob` — scheduled, calls the AI engine
- `GenerateSopJob` — produces an SOP draft for a detected workflow
- `RefreshSopJob` — checks if an existing SOP needs updating
- `ProcessCallRecordingJob` — Whisper transcription → **`POST /generate_from_transcript`** on the AI engine → **Sop** + **SopVersion**

### 3. AI Engine (`ai-engine/`)
Python 3.11, FastAPI, scikit-learn.

- `pattern.py` — frequent-sequence mining over event streams
- `sop.py` — converts a sequence of events into structured SOP markdown
- `transcript.py` — builds an SOP from plain text (used by **`POST /generate_from_transcript`**)
- `llm.py` — pluggable provider (deterministic templates by default, OpenAI optional)
- `api.py` — FastAPI endpoints called by Sidekiq workers (`/detect`, `/generate`, `/generate_from_transcript`)

### 4. Frontend Dashboard (`frontend/`)
React 18 + TypeScript + Vite + Tailwind.

**Public (unauthenticated)**  
- `/login`, `/signup`, `/verify-email` — auth and tenant onboarding  
- `/forgot`, `/reset/:token` — password recovery  
- `/invite/:token` — accept invitation  

**App shell (authenticated)**  
- `/` — overview / process intelligence  
- `/sops`, `/sops/:id` — SOP library and detail + editor + version history  
- `/workflows` — detected patterns awaiting SOP generation  
- `/bottlenecks` — throughput / delay insights  
- `/integrations` — connector setup (OAuth + generic REST)  
- `/organization` — workspace profile, domain verification, billing snapshot (admin)  
- `/settings` — privacy, capture toggles, masking rules, **Call recordings → SOPs** (multipart upload; list/redacted transcript per role)  

### 5. Integrations (`integrations/`)
Thin connector library used by both backend and agent:
- Google Workspace (Drive, Docs, Calendar)
- Microsoft 365 (Graph API)
- Generic REST webhook ingest

## Data flow

```
Agent → POST /api/v1/events (batch)
      → IngestEventBatchJob (Sidekiq) → Postgres

Editors/admins → POST /api/v1/call_recordings (multipart audio)
      → ProcessCallRecordingJob → Whisper → POST ai-engine /generate_from_transcript
      → Sop + SopVersion (draft from transcript)

DetectPatternsJob (cron)
      → POST ai-engine /detect → candidate workflows + linked_event_ids
      → Updates Workflow rows and attaches WorkflowEvents (workflow_id)
      → Optionally GenerateSopJob (Sidekiq) when workspace.settings.auto_generate_sop
        → POST ai-engine /generate → Sop + SopVersion persisted

IntegrationSyncJob (Sidekiq cron, e.g. hourly at :25) pulls connector signals → WorkflowEvent rows (Google / Microsoft / REST)

Frontend ← GET /api/v1/sops, /api/v1/workflows, /api/v1/analytics, PATCH /api/v1/workspace
```

## Privacy boundary

The agent is the **trust boundary**. Anything that crosses the network has
already been through:
1. Masking ruleset (regex + content-type heuristics)
2. User opt-in for the source application
3. Workspace-level retention policy

See [`PRIVACY.md`](PRIVACY.md).
