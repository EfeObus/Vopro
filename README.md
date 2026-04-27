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

MIT — see [`LICENSE`](LICENSE).

## Contact

For inquiries, partnerships, or support: **efe.obukohwo@outlook.com**

---

> Vopro is built on the principle that documentation should not be a manual
> burden. It should be a natural byproduct of work itself.
