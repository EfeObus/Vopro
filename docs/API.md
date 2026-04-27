# Vopro API — v1 Contract

Base URL (dev): `http://localhost:3000/api/v1`

All requests use JSON. Authenticated endpoints require:

```
Authorization: Bearer <jwt>
Content-Type: application/json
```

JWTs come from `POST /auth/login`. They embed `user_id` and `workspace_id` and
expire after 24 hours. Refresh by logging in again or hitting `POST /auth/refresh`.

Rate limits (enforced via `Rack::Attack`):

| Endpoint                | Limit                          |
|-------------------------|--------------------------------|
| `POST /auth/login`      | 5 / minute / IP, 10 / 5 min / email |
| `POST /events/batch`    | 30 / minute / device           |
| All `/api/*`            | 600 / 5 minutes / IP           |

Throttled responses: `429 Too Many Requests` with a `Retry-After` header.

---

## Auth

### `POST /auth/login`

Request:

```json
{ "email": "demo@vopro.local", "password": "vopro1234" }
```

Response `200`:

```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "demo@vopro.local",
    "name": "Demo Admin",
    "role": "admin",
    "workspace_id": "uuid"
  }
}
```

### `GET /auth/me`

Returns the current user. `401` if no token.

---

## Events (agent ingestion)

### `POST /events/batch`

Sent by the desktop agent. Events are masked on-device first; the backend
applies a second masking pass and queues an ingestion job.

Request:

```json
{
  "device_id": "uuid",
  "events": [
    {
      "id": "uuid",
      "kind": "click",
      "application": "Salesforce",
      "url": "https://salesforce.com/opps/...",
      "target": "Convert button",
      "occurred_at": "2026-04-27T17:00:00Z",
      "payload": { "extra": "..." }
    }
  ]
}
```

`kind` is one of: `click | input | navigation | form_submit | shortcut | copy | paste | open | close | focus | blur`.

Response `202`:

```json
{ "accepted": 12, "rejected": 0 }
```

Errors:
- `400` if `device_id` or `events` missing.
- `429` if the device exceeds 30 batches / minute.

---

## SOPs

### `GET /sops`

Returns all SOPs in the caller's workspace. Sorted by `updated_at desc`.

```json
[
  {
    "id": "uuid",
    "title": "Onboard a new enterprise customer in Salesforce",
    "description": "End-to-end process …",
    "status": "published",
    "tags": ["Salesforce", "CustomerSuccess"],
    "owner_name": "Amaka Okeke",
    "average_duration_sec": 612,
    "runs_observed": 142,
    "contributors": 6,
    "confidence": 0.94,
    "last_updated": "2026-04-22T11:30:00Z"
  }
]
```

### `GET /sops/:id`

Returns a SOP including `steps` and `versions`.

`step` shape:

```json
{
  "id": "s1",
  "order": 1,
  "title": "...",
  "description": "...",
  "application": "Salesforce",
  "decision": {
    "question": "Is contract MRR ≥ $5,000?",
    "branches": [
      { "label": "Yes — white-glove", "go_to_step_id": "s5a", "occurrences": 14 }
    ]
  }
}
```

Decision is `null` for ordinary steps.

### `POST /sops`

Body: `{ "sop": { "title", "description", "steps", "tags", "workflow_id"? } }`.
Creates a draft SOP.

### `PATCH /sops/:id`

Body: `{ "sop": { ... }, "summary": "Polish step 3" }`.
Updates the SOP and creates a new entry in `sop_versions`. The `summary` is
stored on the new version row.

### `POST /sops/:id/publish`

Marks the SOP as `published`. Records an audit log row.

### `POST /sops/:id/archive`

Marks the SOP as `archived`.

### `GET /sops/:id/export?format=markdown|json|html`

Returns a rendered export. Markdown is the default.

---

## Workflows (detected patterns)

### `GET /workflows?status=pending|sop_generated|dismissed`

Lists detected workflows. `pending` is what the dashboard shows in
"Newly detected".

### `POST /workflows/:id/generate_sop`

Enqueues `GenerateSopJob`. The job calls the AI engine `/generate` endpoint
and creates a draft SOP linked to this workflow.

Response `202`:

```json
{ "queued": true }
```

### `POST /workflows/:id/dismiss`

Marks a detected workflow as not interesting. It will not be re-surfaced.

---

## Integrations

### `GET /integrations`

Lists every available integration with its current `status`
(`connected | disconnected | error`).

### `GET /integrations/:provider/start`

Begins an OAuth flow for `google | microsoft`. Returns the provider's
authorize URL with a generated `state` value cached on the server for 10 min.

```json
{ "url": "https://accounts.google.com/o/oauth2/v2/auth?…" }
```

### `GET /integrations/:provider/callback?code=…&state=…`

Provider redirects here. Validates state, exchanges the code, persists the
encrypted credentials on the `Integration` record, and writes an audit log.

### `PATCH /integrations/:id`

Body: `{ "integration": { "settings": { … } } }`. Update settings without
re-running OAuth.

### `DELETE /integrations/:id`

Disconnects and clears stored secrets.

---

## Analytics

### `GET /analytics/overview`

Returns the data the dashboard top cards consume:

```json
{
  "sops_total": 24,
  "runs_last_30d": 1842,
  "automation_minutes_saved": 4310,
  "active_users": 18,
  "activity": [
    { "date": "2026-04-21", "captures": 124, "sops_generated": 2 }
  ],
  "bottlenecks": [
    { "workflow": "AP invoice review", "avg_duration_sec": 1840, "outlier_duration_sec": 4200, "occurrences": 56 }
  ]
}
```

---

## Error format

All error responses are JSON:

```json
{ "error": "Human-readable message", "code": "optional_machine_code" }
```

Standard codes:

| HTTP | When |
|------|------|
| `400` | Bad request body or missing parameter |
| `401` | Missing / invalid token |
| `403` | Authenticated but not allowed |
| `404` | Resource not found in this workspace |
| `422` | Validation failed |
| `429` | Rate limited |
| `500` | Server error |
