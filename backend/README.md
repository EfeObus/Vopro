# Vopro Backend (Rails API)

Rails 7 API mode. PostgreSQL (with JSONB), Redis, Sidekiq.

## Setup

```bash
bundle install
bin/rails db:create db:migrate db:seed
bin/rails server          # http://localhost:3000
bundle exec sidekiq -C config/sidekiq.yml
```

Seed creates a demo workspace and an admin user (`admin@vopro.local` /
`vopro1234`).

## Endpoints (v1)

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | Email + password → JWT |
| GET  | `/api/v1/auth/me` | Current user |
| POST | `/api/v1/events/batch` | Agent uploads masked events |
| GET  | `/api/v1/sops` | List SOPs |
| GET  | `/api/v1/sops/:id` | Show SOP |
| PATCH | `/api/v1/sops/:id` | Edit SOP (creates a new version) |
| POST | `/api/v1/sops/:id/publish` | Publish |
| GET  | `/api/v1/sops/:id/export?format=markdown` | Export |
| GET  | `/api/v1/workflows?status=pending` | List detected patterns |
| POST | `/api/v1/workflows/:id/generate_sop` | Trigger SOP generation |
| GET  | `/api/v1/analytics/overview` | Dashboard analytics |

## Tests

```bash
bundle exec rspec
```
