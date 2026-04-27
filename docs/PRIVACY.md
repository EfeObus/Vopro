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

See `agent/src/masking.ts`.

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
