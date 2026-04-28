# B2B onboarding and permission model

Vopro is sold **business-to-business (B2B)**. Individuals do not purchase seats on their own; the **organization** contracts for the workspace.

## Who typically brings Vopro in

Common internal champions:

- **Operations / process improvement** — documentation quality and standardization
- **IT / security** — deployment, data boundaries, integrations
- **HR / training** — playbooks and employee-facing procedures
- **CTO / engineering leadership** (especially in tech companies) — developer workflows and internal tools

---

## Standard signup flow (product shape)

These steps describe the intended commercial journey; exact screens and automation may evolve in the product.

### 1. Organization creates a workspace

An **admin** registers the tenant with:

- Company or team name  
- **Email domain** (e.g. `company.com`) as the anchor for who belongs  
- **Initial admin account** (identity + credentials)

### 2. Domain verification

To reduce abuse and mistaken signups, the admin proves control of the organization’s domain:

- **Email verification** on an address at that domain, and/or  
- **DNS TXT (or similar) record** at the domain  

That step supports the rule: **only people the org trusts can stand up Vopro for that tenant.**

### 3. Plan selection

Examples of how tiering often works in this space:

- **Trial** — limited seats, time-boxed, or reduced capture volume  
- **Paid** — per seat, per active user, and/or usage based (e.g. workflows captured or events ingested)

### 4. Admin dashboard

After onboarding, the admin can:

- **Invite users** by email (scoped to the verified domain unless you explicitly allow exceptions)  
- **Configure policies** — masking, retention, capture toggles (see [`PRIVACY.md`](./PRIVACY.md))  
- **Connect integrations** — OAuth connectors and REST hooks  
- **Tune capture rules** — what is observed and what stays local  

---

## Who gives employees permission?

**Both layers matter:**

### Layer 1 — Organizational authorization

Typically owned by **IT, security, or legal**:

- Approval to **deploy** the capture agent on corporate-managed machines  
- Agreement on **what systems** may be observed and **what flows** into integrations  
- Sign-off on **data retention** and subprocessors  

That answers “may Vopro run here?” at company level.

### Layer 2 — Individual consent (non-negotiable)

When someone **installs the agent** or **first uses capture**, they should see clear copy along these lines:

> Your organization uses Vopro to capture workflows for documentation. Sensitive fields are masked on your device before sync. You can pause capture or opt out at any time.

Then:

- **Accept** → capture proceeds according to org policy and their own toggles  
- **Decline** → **no tracking** (or restricted modes only), regardless of org rollout  

Skipping Layer 2 creates legal and cultural risk; org mandate alone is not enough for ethical rollout.

Technical counterparts (masking, opt-in capture, pause) live in [`PRIVACY.md`](./PRIVACY.md).

---

## Summary

| Question | Answer |
|----------|--------|
| Who buys? | The **organization** (B2B). |
| Who verifies the tenant? | **Admin** + **domain proof**. |
| Who allows deployment? | **Org** (IT/security/legal). |
| Who must consent to capture? | **Each employee**, with clear notice and decline path. |

---

## Dashboard and configuration (this repo)

For local development, set **`FRONTEND_ORIGIN`** in `.env` (e.g. `http://localhost:5173`) so signup verification links in email point at the UI. See `.env.example`.

Relevant routes in the web app:

- **`/signup`** — create workspace (organization tenant + admin).
- **`/verify-email?token=…`** — consume email verification after signup.
- **`/organization`** — admin: domain DNS verification, plan snapshot, seats.

The API enforces **invite emails on the workspace `claimed_domain`** when that field is set (`POST /api/v1/invitations`). Full billing/checkout (e.g. Stripe) is not wired in the dashboard yet; trial and plan fields are exposed for future integration.
