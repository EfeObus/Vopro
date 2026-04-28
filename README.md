# Vopro — Auto SOP Generator

> Turn real work into real documentation. Automatically.

Vopro is an intelligent workflow observation and documentation platform that
automatically generates Standard Operating Procedures (SOPs) from how work is
*actually* performed.

Instead of relying on hand‑written documentation that quickly goes stale, Vopro
observes workflows, captures real user actions (with privacy guardrails), and
converts them into structured, accurate, continuously updated SOPs.

> Vopro documents what people actually do, not what they claim to do.

---

## Why

Organizations face persistent documentation problems:

- SOPs that are outdated or incomplete
- Time-consuming manual documentation processes
- Loss of institutional knowledge when employees leave
- Inconsistent execution of processes across teams

Traditional tools depend on manual input, which leads to inefficiencies and
inaccuracies over time.

## How Vopro solves it

- **Passively observes** workflows across systems and applications
- **Detects** repeatable processes and behavioral patterns
- **Generates** SOPs from real user activity
- **Continuously updates** documentation as workflows evolve
- **Respects privacy** with on-device masking and opt-in capture

---

## Key Features

### Workflow Capture Engine
- Tracks user actions across applications: clicks, inputs, navigation
- Supports desktop environments, web applications, and internal systems
- Identifies repeatable processes over time

### AI SOP Generator
Transforms captured workflows into structured SOPs with:
- Step-by-step instructions
- Optional screenshots
- Decision points
- Conditional logic

### Continuous SOP Updates
- Monitors workflow changes and updates SOPs automatically
- Maintains version history to track evolution of processes

### Cross-Platform Integration
Connects with CRM systems, ERPs, internal dashboards, productivity tools, and
web browsers.

### Editable and Exportable SOPs
Generated SOPs are human-readable and editable. Export to:
- PDF
- Markdown
- Internal knowledge base formats

### Process Intelligence Dashboard
Insights into frequently executed workflows, bottlenecks and delays, and
process inefficiencies.

### Privacy and Control
- Sensitive data masking (on device, before any sync)
- User-level permissions
- Opt-in tracking mechanisms
- Compliance readiness (GDPR principles)

---

## Architecture

```
┌──────────────┐      events      ┌──────────────┐    jobs     ┌──────────────┐
│  Electron    │ ───────────────▶ │   Rails API  │ ──────────▶ │  AI Engine   │
│  Agent (TS)  │                  │   (Postgres) │             │   (Python)   │
└──────────────┘                  └──────┬───────┘             └──────┬───────┘
                                         │                            │
                                         │   SOPs / analytics         │
                                         ▼                            │
                                  ┌──────────────┐                    │
                                  │  React + TS  │ ◀──────────────────┘
                                  │  Dashboard   │      generated SOPs
                                  └──────────────┘
```

| Layer | Tech |
| --- | --- |
| Frontend dashboard | React 18, TypeScript, Vite, Tailwind, lucide-react |
| Desktop capture agent | Electron, TypeScript, on-device PII masking |
| API | Ruby on Rails (API mode), PostgreSQL (JSONB), Sidekiq + Redis |
| AI / processing | Python, scikit-learn, frequent-sequence pattern detection, pluggable LLM |
| Integrations | Google Workspace, Microsoft 365, generic REST |

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a deeper walk-through.

---

## How It Works

1. A user performs a task as usual.
2. Vopro captures workflow events in the background (with masking).
3. The system detects repeatable patterns.
4. AI generates an SOP draft.
5. The user reviews and edits the SOP if necessary.
6. The SOP is stored and continuously updated.

---

## Getting Started

### Prerequisites
- Node.js 18+
- Ruby 3+
- PostgreSQL 14+
- Redis 6+
- Python 3.11+
- Docker (optional, recommended for local dev)

### Quickest path: Docker Compose

```bash
git clone https://github.com/your-org/vopro.git
cd vopro
make up           # boots Postgres, Redis, backend, ai-engine, frontend
```

Frontend will be at <http://localhost:5173>, API at <http://localhost:3000>.

### Manual install

Redis must be running for Sidekiq background jobs (`generate_sop`, event ingestion, etc.). Start **`redis-server`** (or `brew services start redis`, or `docker compose up -d redis`), then run a worker:

```bash
cd backend && bundle exec sidekiq
```

Run Rails and Sidekiq in separate terminals alongside Redis.

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd ../backend && bundle install
bin/rails db:create db:migrate
bin/rails server

# AI engine
cd ../ai-engine && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m vopro_ai.worker

# Agent (optional)
cd ../agent && npm install && npm run dev
```

---

## Project Structure

```
vopro/
├── frontend/         # React + TypeScript dashboard (Vite, Tailwind)
├── backend/          # Rails API (Postgres, Sidekiq, Redis)
├── agent/            # Electron + TS desktop capture agent
├── ai-engine/        # Python: pattern detection + SOP generation
├── integrations/     # External service connectors (Google, MS, REST)
├── docs/             # Architecture, privacy, and generated SOPs
├── docker-compose.yml
└── Makefile
```

---

## Security

- End-to-end encryption for sensitive data in transit
- On-device masking for PII before any sync
- Role-based access control
- Audit logging for all SOP changes
- Data anonymization options

See [`docs/PRIVACY.md`](docs/PRIVACY.md).

### Secrets management & rotation

Vopro deliberately reads every credential from environment variables — never
from source control — so you can rotate them without redeploying code. The
[`.env.example`](.env.example) file lists every variable; the ones marked
`(secret)` need a rotation policy.

**Where secrets live**

- **Local dev**: `.env` (gitignored). Never commit a real `.env`.
- **Production**: a managed store (AWS Secrets Manager / HashiCorp Vault /
  GCP Secret Manager / Doppler / 1Password Connect). Inject at boot via
  the platform's standard env mechanism — do not bake secrets into images.
- **CI**: GitHub Actions encrypted secrets (Settings → Secrets → Actions).
  The CI matrix in [`.github/workflows/ci.yml`](.github/workflows/ci.yml)
  intentionally runs without real provider keys; only the deterministic
  paths execute on PRs.

**Rotation cadence**

| Variable                                          | Cadence    | Notes |
| ------------------------------------------------- | ---------- | ----- |
| `SECRET_KEY_BASE`                                 | 90 days    | Rails session/cookies. Roll on a deploy. |
| `JWT_SECRET`                                      | 90 days    | Invalidates existing tokens; use a kid-based accept-both window for a graceful rollover. |
| `SIDEKIQ_WEB_PASSWORD`                            | 90 days    | `openssl rand -base64 24`. |
| `AR_ENCRYPTION_PRIMARY_KEY` / `DETERMINISTIC_KEY` / `KEY_DERIVATION_SALT` | 180 days   | Use Rails' multi-key rotation: add new key as `next`, re-encrypt rows, then promote. Never overwrite — encrypted columns will become unreadable. |
| `OPENAI_API_KEY`                                  | 180 days, immediately on leak | Use a project-scoped key with a spend cap. |
| `GOOGLE_CLIENT_SECRET` / `MICROSOFT_CLIENT_SECRET` | 180 days   | Rotate from the provider console, then redeploy. |
| `SENTRY_DSN`                                      | On project re-key | Treat as semi-secret; revoke at source if leaked. |

**Rotation runbook (symmetric secrets)**

1. Mint a new value with the generator command in `.env.example`.
2. Push it to your secrets manager as the new value, keep the previous as a
   read-only fallback for the migration window.
3. Deploy. Tail logs and watch `audit_logs` for `auth.failure` spikes — if
   `JWT_SECRET` rotated, expect a brief sign-out wave.
4. After the agreed grace window (24 h is typical), remove the previous
   value from the secrets manager.

**Rotation runbook (`AR_ENCRYPTION_*`)**

1. `cd backend && bundle exec rails db:encryption:init` to generate keys —
   record them in your secrets manager as the *next* set, do not yet make
   them primary.
2. Configure `config.active_record.encryption.previous` to keep the old
   keys live for decryption.
3. Re-encrypt records (`Integration.find_each(&:save!)` or a Sidekiq job).
4. Promote the new keys to primary, demote the old keys to `previous` for
   one full backup cycle, then remove them.

**On suspected compromise**

1. Rotate the affected secret immediately (skip the grace window).
2. Revoke any provider-side credentials (OAuth client, OpenAI key).
3. Force a global sign-out by also rotating `JWT_SECRET`.
4. Audit `audit_logs` and integration access logs for the exposure window.
5. File a privacy notice if PII could have been accessed (see
   [`docs/PRIVACY.md`](docs/PRIVACY.md)).

---

## Use Cases

- Employee onboarding
- Process standardization
- Compliance documentation
- Knowledge retention
- Operational optimization

---

## Roadmap

**Phase 1 (MVP) — current**
- Workflow capture
- SOP auto-generation
- Manual editing

**Phase 2**
- Real-time updates
- Expanded integrations
- Analytics dashboard

**Phase 3**
- Predictive workflow optimization
- AI-driven recommendations
- Enterprise scalability features

---

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

---

## License

**Proprietary — All rights reserved.** Vopro is **not** open source. See
[`LICENSE`](LICENSE) for the full Vopro Proprietary Software License.

In short:

- The source is published for **evaluation and security review only**.
- Any production, commercial, or internal-business use requires a signed
  Commercial License from the copyright holder.
- Forking, redistributing, training ML models on, or hosting the Software as
  a service is **prohibited** without prior written consent.

For licensing inquiries: **legal@vopro.com**.

Third-party dependencies fetched at build time remain governed by their own
licenses; this License applies only to materials owned or controlled by Vopro.

## Contact

For inquiries, partnerships, or support: **efe.obukohwo@outlook.com**

---

> Vopro is built on the principle that documentation should not be a manual
> burden. It should be a natural byproduct of work itself.
