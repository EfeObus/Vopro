# Privacy

Vopro is a workflow observation tool. We take the responsibility of running on
people's machines seriously.

## Principles

1. **On-device first.** Captured events are masked locally *before* any network
   call. Raw input never leaves the device.
2. **Opt-in by source.** Capture is disabled by default. Users explicitly enable
   it per application (e.g., "capture from Salesforce", "do not capture from
   personal Gmail").
3. **Visible state.** The agent always shows a clear indicator when capture is
   active. Pausing is a single click away.
4. **Short retention by default.** Raw events have a 30-day retention; only
   derived SOPs are retained long-term unless the workspace opts in.
5. **No silent updates.** Masking rules and retention can only be loosened with
   workspace admin approval and an audit log entry.

## Masking

Default masking rules cover:

- Emails (`[email-redacted]`)
- Phone numbers (E.164, NANP, common international)
- Credit card numbers (Luhn-validated)
- Government IDs (SSN, NI, etc.)
- API keys, tokens, JWTs
- Password fields (always, by HTML attribute)
- Anything matching workspace-defined custom regex

See `agent/src/masking.ts`. The same rule set is applied a second time on the
backend (`MaskingService`) so masking still happens even if a hand-rolled HTTP
client tries to bypass the agent.

### What masking *cannot* catch

The default rules are deterministic regex/heuristic checks. They are excellent
at structured PII (cards, SSNs, JWTs) and very good at semi-structured PII
(emails, phone numbers), but they can leak:

- **Free-form names and addresses** — "Jane Doe at 221B Baker Street" has no
  structural marker, so the regex layer leaves it alone.
- **Internal project codenames or customer names** that happen to be common
  words — "Project Falcon" looks like ordinary copy.
- **Photographs / screenshots** — Vopro never captures pixels in the default
  pipeline, but if a third-party integration is wired to upload images, those
  images are out of scope of this masking layer.
- **Long-tail document IDs** that don't match a known format — random hex
  strings ≥ 24 chars are masked as tokens, but shorter or alphanumeric IDs
  (e.g. legacy CRM IDs) pass through unless added to a custom regex.

If you need stronger guarantees, treat the regex layer as a floor and add one
of the controls below.

### Optional: on-device NER pass

For workspaces that handle sensitive free-text (HR notes, support transcripts,
clinical handoffs, legal review), Vopro supports an opt-in second pass that
runs a small named-entity-recognition model on-device *before* the regex pass:

- Model: `Xenova/bert-base-NER` (or any ONNX-compatible NER) loaded via
  `@xenova/transformers` inside the Electron agent. Model weights stay on
  disk; no inference traffic leaves the machine.
- Entities scrubbed by default: `PERSON`, `ORG`, `LOC`, `MISC`. Each match is
  replaced by `[ner:<label>]` so reviewers can still see the *shape* of an
  event without the content.
- Performance: ~30–60 ms / event on a modern laptop CPU; the agent batches
  events on a 200 ms window so the UX impact is invisible.
- Configuration: `agent.config.json` → `masking.ner.enabled = true` and
  optionally `masking.ner.entities = ["PERSON", "ORG"]` to narrow scope.
- Audit: enabling, disabling, or changing entity scope writes a row to
  `audit_logs` with action `masking.ner.changed`.

Until your workspace turns this on, treat the masking layer as a *good first
filter* rather than a guarantee. Pair it with:

1. **Source-level opt-in** — capture only from apps that need observation.
2. **Custom regex** — add patterns for your codenames, account IDs, internal
   ticket prefixes, etc. (workspace settings → masking rules).
3. **Short retention** — keep raw events at 30 days or less; SOPs derive
   patterns and shouldn't need the originals long term.

## GDPR / data subject rights

- **Access**: a user can export every event captured about them via the
  dashboard.
- **Deletion**: deleting a user purges their events and removes them from any
  derived SOPs (the SOP regenerates from the remaining contributors).
- **Portability**: events and SOPs export as JSON / Markdown / PDF.

## Audit

Every change to:
- Capture state (on/off)
- Masking rules
- SOP edits
- Permissions

…produces an entry in `audit_logs` (immutable, append-only).

## Reporting

Found a privacy issue? Email **efe.obukohwo@outlook.com**. Please do not file
public issues.
