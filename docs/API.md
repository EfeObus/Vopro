# Vopro API — v1 Contract

Base URL (dev): `http://localhost:3000/api/v1`

All requests use JSON. Authenticated endpoints require:

```
Authorization: Bearer <jwt>
Content-Type: application/json
```

JWTs come from `POST /auth/login`. They embed `user_id` and `workspaceId` and
expire after 24 hours. Refresh by logging in again or hitting `POST /auth/refresh`.

**Casing convention:** almost all JSON fields use **`camelCase`** (including analytics and SOP payloads). Two intentional exceptions:

- **`Workspace.settings`** — keys remain **`snake_case`** (e.g. `auto_generate_sop`, `masking_rules`) so they match the JSONB column and Ruby conventions.
- **`error.code`** — stable **`snake_case`** machine codes (see [Common codes](#common-codes)).

Rate limits (enforced via `Rack::Attack`):

| Endpoint                | Limit                                |
|-------------------------|--------------------------------------|
| `POST /auth/login`            | 5 / minute / IP, 10 / 5 min / email |
| `POST /auth/password/forgot`  | 3 / 15 min / IP, 3 / hour / email   |
| `POST /events/batch`          | 30 / minute / device                |
| `POST /signup`                | 5 / hour / IP                       |
| `POST /call_recordings`       | 15 / hour / IP                      |
| All `/api/*`                  | 600 / 5 minutes / IP                |

Throttled responses: `429 Too Many Requests` with a `Retry-After` header and
the [unified error envelope](#error-envelope) below, plus a top-level
`retry_after` (seconds) for clients that key off it directly.

---

## Error envelope

Every non-2xx response from the API uses the same shape so that clients
need only one parser. The HTTP status code remains authoritative; the body
just adds a stable machine `code`, a human `message`, the request id (for
support correlation), and optional `details`.

```json
{
  "error": {
    "code":       "weak_password",
    "message":    "Password must be at least 12 characters",
    "status":     422,
    "request_id": "0fb0a8a6-4f0c-4f48-9d97-94e7a2cabc31",
    "details":    { "min_length": 12 }
  }
}
```

| Field        | Notes |
|--------------|-------|
| `code`       | Stable, snake_case. Switch on this — never on the human message. |
| `message`    | Localised in the future. Suitable for inline UI display. |
| `status`     | Mirrors the HTTP status for convenience. |
| `request_id` | Surface in support tickets / Sentry breadcrumbs. |
| `details`    | Optional. Validation field map, allowed enums, retry hints, etc. |

### Common codes

| HTTP | `code`                  | When |
|------|-------------------------|------|
| 400  | `bad_request`           | Malformed body / missing required param. |
| 400  | `invalid_role`, `invalid_device_id`, `unsupported_provider` | Domain-specific validation. |
| 401  | `unauthorized`          | Missing / invalid / revoked token. |
| 401  | `invalid_credentials`   | Wrong email/password on login. |
| 403  | `forbidden`             | Authenticated but lacks the required role. |
| 404  | `not_found`             | Resource absent or scoped to another workspace. |
| 409  | `conflict`, `user_exists`, `integration_exists` | Duplicate resource, invite clash, or OAuth integration row already present (disconnect first). |
| 410  | `invitation_expired`, `reset_token_expired` | Single-use token already consumed or past expiry. |
| 413  | `payload_too_large`, `batch_too_large`, `audio_too_large` | Body / batch exceeded the configured maximum; or call-recording audio over **`MAX_AUDIO_BYTES`**. |
| 422  | `unprocessable_entity`  | Validation failed; see `details` for the field map. |
| 422  | `audio_empty`, `audio_too_small` | Call recording upload failed size checks (**`MIN_AUDIO_BYTES`** … **`MAX_AUDIO_BYTES`**). |
| 422  | `weak_password`, `no_valid_events` | Domain-specific validation. |
| 422  | `personal_email_not_allowed` | Signup with a consumer email (e.g. Gmail) when `RAILS_ENV` is not `development`. |
| 429  | `rate_limited`          | Throttle tripped; honour `Retry-After`. |
| 500  | `internal_error`        | Server bug. Always paired with a Sentry report. |

Frontend clients can use the `ApiError` class in
[`frontend/src/lib/api.ts`](../frontend/src/lib/api.ts) which surfaces
`status`, `code`, `message`, `details`, and `requestId` directly off the
thrown error.

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
    "workspaceId": "uuid"
  }
}
```

Response `401` (bad credentials):

```json
{
  "error": {
    "code": "invalid_credentials",
    "message": "Invalid credentials",
    "status": 401,
    "request_id": "<uuid>"
  }
}
```

Response `429` (throttled — IP burst or per-email lockout):

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: application/json
```

```json
{ "error": "Too many requests", "retry_after": 60 }
```

### `POST /auth/refresh`

Authenticated. Issues a fresh JWT for the calling user. The presented token is
revoked at the same time (its `jti` is added to a Redis-backed denylist), so a
stolen token cannot keep being refreshed.

Response `200`:

```json
{ "token": "eyJhbGc..." }
```

### `DELETE /auth/logout`

Authenticated. Revokes the presented JWT (denylist entry expires when the
token would have naturally expired). Returns `204 No Content`. The frontend
calls this with `keepalive: true` on logout, then clears local storage.

### `GET /auth/me`

Authenticated. Returns the calling user (same shape as `user` above). `401` if
the token is missing or expired.

### `POST /auth/password/forgot`

Public. Always returns `202` to avoid leaking whether the email exists.

```json
{ "email": "demo@vopro.local" }
```

In non-production environments the response includes the reset `token` and its
`expiresAt` so the flow can be exercised without an email transport. In
production only `{ "status": "sent" }` is returned and the token is delivered
out-of-band by the configured mailer.

### `POST /auth/password/reset`

Public. Consumes a reset token and rotates the password.

```json
{ "token": "…", "password": "new-strong-passphrase" }
```

- `204 No Content` — password rotated; all other outstanding reset tokens for
  that user are invalidated.
- `410 Gone` — token is unknown, expired, or already consumed.
- `422 Unprocessable Entity` — password shorter than 12 characters.

### Invitations (admin)

| Method | Path                                | Auth   | Notes                                  |
|--------|-------------------------------------|--------|----------------------------------------|
| `GET`  | `/invitations`                      | admin  | List active invitations.               |
| `POST` | `/invitations`                      | admin  | `{ email, role }`. Returns `token`.    |
| `DELETE` | `/invitations/:id`                | admin  | Revoke a pending invitation.           |
| `GET`  | `/auth/invitations/:token`          | public | Validate without consuming.            |
| `POST` | `/auth/invitations/:token/accept`   | public | `{ name, password }`. Returns `token + user`. |

`role` must be one of `admin | editor | viewer`. Invitations expire after 7
days; expired or revoked tokens return `410 Gone`. Acceptance is transactional:
the user is created, the invitation is marked `accepted_at`, and a JWT is
returned in one round-trip.

When the workspace has a **`claimed_domain`**, `POST /invitations` requires the
invite email’s domain to match it (`422` / `domain_mismatch` otherwise). If
`claimed_domain` is blank (legacy tenants), any email address is allowed.

---

## Events (agent ingestion)

### `POST /events/batch`

Sent by the desktop agent. Events are masked on-device first; the backend
validates each event, applies a second masking pass, and queues an ingestion
job.

Request:

```json
{
  "device_id": "uuid",
  "events": [
    {
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

`kind` must be one of: `click | input | navigation | focus | blur |
form_submit | shortcut | copy | paste | open | close`. Invalid kinds and
malformed `occurred_at` values are dropped silently and counted in `rejected`.

Response `202`:

```json
{ "accepted": 12, "rejected": 0, "job_id": "abc..." }
```

Errors:
- `400` — `device_id` or `events` missing.
- `413` — body > 1 MB or > 500 events.
- `422` — every event failed validation (none accepted).
- `429` — device exceeded 30 batches / minute.

Response `429` (per-device throttle):

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: application/json
```

```json
{ "error": "Too many requests", "retry_after": 60 }
```

The agent (`agent/src/sync.ts`) reads `Retry-After`, applies jitter, and re-queues the
unsent batch. Burst senders should respect both the header and the body field.

---

## SOPs

### `GET /sops`

Returns all SOPs in the caller's workspace, sorted by `updatedAt desc`.

```json
[
  {
    "id": "uuid",
    "title": "Onboard a new enterprise customer in Salesforce",
    "description": "End-to-end process …",
    "status": "published",
    "tags": ["Salesforce", "CustomerSuccess"],
    "ownerName": "Amaka Okeke",
    "ownerInitials": "AO",
    "averageDurationSec": 612,
    "runsObserved": 142,
    "contributors": 6,
    "confidence": 0.94,
    "lastUpdated": "2026-04-22T11:30:00Z"
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
      { "label": "Yes — white-glove", "goToStepId": "s5a", "occurrences": 14 }
    ]
  }
}
```

`decision` is `null` for ordinary steps.

`version` shape:

```json
{
  "id": "uuid",
  "version": 4,
  "authoredBy": "Vopro AI",
  "authoredAt": "2026-04-22T11:30:00Z",
  "summary": "Drift detected — proposed update from recent runs."
}
```

### `POST /sops`

Body: `{ "sop": { "title", "description", "steps", "tags", "workflow_id"? } }`.
Creates a draft SOP.

### `PATCH /sops/:id`

Body: `{ "sop": { ... }, "summary": "Polish step 3" }`. Updates the SOP and
creates a new entry in `sop_versions`.

### `GET /sops/:id/versions`

Returns the SOP's full version history (newest first):

```json
[
  { "id": "uuid", "version": 4, "authoredBy": "Vopro AI", "authoredAt": "...", "summary": "..." }
]
```

### `POST /sops/:id/publish`

Marks the SOP as `published`. Records an audit log row.

### `POST /sops/:id/archive`

Marks the SOP as `archived`.

### `GET /sops/:id/export?format=markdown|json|pdf`

Returns a downloadable export.

| `format` | Default | Response |
|----------|---------|----------|
| `markdown` or `md` | ✓ | `text/markdown` — portable editing |
| `json` | | `application/json` — structured snapshot |
| `pdf` | | `application/pdf` — printable document (Prawn-rendered server-side) |

The download filename is derived from the SOP title (`parameterize`) when possible.

Responses include `Cache-Control: private, max-age=0, must-revalidate` and `Vary: Authorization`
so authenticated downloads are not cached as shared content.

---

## Workflows (detected patterns)

### `GET /workflows?status=pending|sop_generated|dismissed`

Lists detected workflows in this workspace. `pending` is what the dashboard
shows in "Newly detected".

### `GET /workflows/:id`

Returns one workflow with its event signature and recent occurrences.

### `PATCH /workflows/:id`

Body: `{ "workflow": { "title": "...", "status": "pending" } }`. Mostly used to
rename a detected pattern before generating its SOP.

### `POST /workflows/:id/generate_sop`

Enqueues `GenerateSopJob`. The job calls the AI engine `/generate` endpoint
and creates a draft SOP linked to this workflow.

Response `202`:

```json
{ "status": "queued" }
```

If Sidekiq cannot reach Redis (enqueue fails), the API returns **`503`** with
`error.code` **`redis_unavailable`** instead of a generic `500`. Start Redis
and a Sidekiq worker before calling this endpoint.

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

Provider redirects the browser here. The endpoint validates state, exchanges
the code, persists the encrypted credentials on the `Integration` record,
writes an audit log, and renders an HTML success page that closes the popup
and notifies the opener with  
`postMessage({ type: 'vopro:integration-callback', ok: true, provider, message }, …)`  
(target origins from `FRONTEND_ORIGIN`, or `*` in dev when unset).  
Errors send the same payload shape with `ok: false`.

### `PATCH /integrations/:id`

Body: `{ "integration": { "settings": { … } } }`. Update settings without
re-running OAuth.

### `DELETE /integrations/:id`

Disconnects and clears stored secrets.

### `POST /integrations`

Create or **upsert** an integration row. For **`provider: "rest"`**, if a REST row already exists for the workspace, it is **updated** (new endpoint / token). For non-REST providers, if a row already exists, respond **`409`** with `code: integration_exists` — disconnect first or rely on OAuth reconnect flows.

Request body nests fields under `integration` using **`snake_case`** keys (`provider`, `status`, `settings`, `secrets`) per Rails strong params. Responses still use **`camelCase`** where noted (e.g. `createdAt` on integration rows). Nested maps inside `settings` / `secrets` follow provider-native naming.

**Credentials storage:** OAuth tokens and API keys live in the `integrations`
table (`secrets` column, encrypted at rest when AR encryption keys are configured).

---

## Workspace

Workspace-wide preferences live on `Workspace.settings` (JSONB).

### `GET /workspace`

Authenticated. Returns the workspace profile merged with defaults:

```json
{
  "id": "uuid",
  "name": "Acme Corp",
  "slug": "acme",
  "settings": {
    "auto_generate_sop": false,
    "event_retention_days": 30,
    "capture_web_enabled": true,
    "capture_desktop_enabled": true,
    "capture_terminal_enabled": false,
    "capture_pause_incognito": true,
    "masking_rules": [
      { "id": "email", "enabled": true },
      { "id": "phone", "enabled": true },
      { "id": "cc", "enabled": true },
      { "id": "gov", "enabled": true },
      { "id": "token", "enabled": true },
      { "id": "password", "enabled": true }
    ]
  }
}
```

Defaults merge missing keys server-side; the stable rule ids are `email`, `phone`, `cc`, `gov`, `token`, `password`.

### `PATCH /workspace`

Admin only. Body shape:

```json
{
  "workspace": {
    "settings": {
      "auto_generate_sop": true,
      "event_retention_days": 45
    }
  }
}
```

---

## Analytics

### `GET /analytics/overview`

Returns the data the dashboard top cards consume:

```json
{
  "sopsTotal": 24,
  "runsLast30d": 1842,
  "automationMinutesSaved": 4310,
  "activeUsers": 18,
  "runsLast7d": 210,
  "runsPrev7d": 180,
  "runsWeekOverWeekPercent": 16.7,
  "publishedSopsUpdatedLast7d": 3,
  "estimatedHoursSaved": 71.8,
  "runsByDay": [
    { "date": "2026-04-21T00:00:00Z", "label": "Mon", "runs": 124, "sops": 2 }
  ],
  "bottlenecks": [
    { "workflow": "AP invoice review", "avgDurationSec": 1840, "outlierDurationSec": 4200, "occurrences": 56 }
  ]
}
```

`runsWeekOverWeekPercent` may be `null` when there was no activity in the prior 7-day window.

`publishedSopsUpdatedLast7d` counts **published** SOPs whose record was **updated** in the last 7 days (edits and republishes), not strictly “first published at.”

### `GET /analytics/bottlenecks`

Returns just the bottlenecks array (same row shape as above), unbounded by
the overview's top-N limit.

---

## Organization & onboarding

### `POST /signup` (public)

Creates a workspace, an admin user, a signup email-verification token, and sends `SignupMailer`. Returns `201` with `{ token, user, workspace }` (same user/workspace shapes as login / organization snapshot).

Request body wraps fields under `signup`:

- `workspace_name`, `claimed_domain`, `admin_email`, `admin_password` (≥ 12 chars), `admin_name`
- Optional: `slug`, `billing_plan`, `seats_limit`

In **production**, `admin_email` must be on a **corporate** domain (consumer domains such as Gmail are rejected with `personal_email_not_allowed`). It must also match `claimed_domain`.

In **development** (`RAILS_ENV=development`), consumer emails are allowed; if `claimed_domain` does not match the domain of `admin_email`, the server stores the admin email domain as `claimed_domain`.

Other errors: `domain_mismatch`, `weak_password`, `validation_failed`, `workspace_exists`, etc.

### `POST /signup/verify_email` (public)

Body: `{ "token": "<raw token from email>" }`. Consumes the token and sets `domain_verified_at` on the workspace. Returns `{ ok: true, workspaceId }`. Invalid/expired tokens: `410` with `invalid_token`.

### `GET /organization` (authenticated, **admin**)

Returns an organization snapshot: `claimedDomain`, `domainVerified`, `billingPlan`, `trialEndsAt`, `trialActive`, `seatsLimit`, `seatsUsed`, `dnsTxtHost`, `dnsTxtValue` (token only after starting DNS verification).

### `POST /organization/domain_dns/start` (authenticated, **admin**)

Stores a TXT verification token on the workspace and returns `{ dnsTxtHost, dnsTxtValue }` for `_vopro.<claimed_domain>`.

### `POST /organization/domain_dns/verify` (authenticated, **admin**)

Resolves DNS and, when the TXT record contains the issued token, sets `domain_verified_at`. Returns the updated organization snapshot. If TXT is missing: `422` with `dns_verification_failed`.

### `POST /me/consents` (authenticated)

Body: `{ "consent_key": "workflow_capture_policy_v1" }`. Records consent (`201 Created`). Unknown keys: `400`.

---

## Call recordings (voice → transcript → SOP draft)

### `GET /api/v1/call_recordings` · `GET /api/v1/call_recordings/:id` (authenticated)

Lists or shows workspace call uploads. Response objects include `transcript`
only when the caller **may read transcripts**: **admin/editor**, or the user who
uploaded the recording. Otherwise `transcript` is `null` and `transcriptRedacted`
is `true`.

### `POST /api/v1/call_recordings` (authenticated, **editor or admin**)

`multipart/form-data` with field **`audio`** (file). Optional **`title_hint`** string.

Allowed extensions match Whisper (e.g. `.mp3`, `.wav`, `.webm`); **max ~24MB**, minimum non-empty size enforced (`audio_empty` / `audio_too_small`). Rate-limited
(**15 POSTs / hour / IP** via Rack::Attack). Requires **Redis + Sidekiq** — if enqueue fails, **`503`** with `redis_unavailable` (no orphaned DB row after cleanup). On success returns **`202 Accepted`** with the
pending row (`upload_failed` if disk/write fails).

Audit action: `call_recording.create`.

---

## GDPR

### `GET /me/export`

Authenticated. Returns the calling user's personal data archive (profile,
emitted workflow events, **`callRecordings`** — transcripts and metadata for rows
they uploaded — owned SOPs). Suitable for a "download my data" button.

### `DELETE /me`

Authenticated. Deletes the user's workflow events, **`destroy`s their call recordings**
(including any pending audio on disk), then anonymises the user record.
The row is retained for referential integrity (FKs from `audit_logs`,
`sops.owner_id`) but `email`, `name`, `password_digest`, and `deleted_at` are
overwritten. An `auth.account_deleted` audit-log row is recorded.

---

## Health

### `GET /health`

Lightweight liveness probe — no database hit. Returns `{ status: "ok" }`.

### `GET /ready`

Readiness probe. Verifies Postgres, Redis, and the AI engine. Returns
`200 { status: "ok", checks: { … } }` when all dependencies pass and `503`
otherwise. Use this for Kubernetes `readinessProbe` and load balancer health
checks.

Non-2xx responses use only the [unified error envelope](#error-envelope) at the top of this document (not a bare `{ "error": "…" }` string).
