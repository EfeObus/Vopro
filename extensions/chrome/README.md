# Vopro Capture (Chrome extension)

Captures opted-in browser activity — page navigations, button clicks, form
submits, focus into text inputs — and forwards it to the local Vopro agent
running on this machine. The agent re-masks each event and posts to your
Vopro backend in batches.

## Install (developer mode)

1. Start the Vopro agent: `cd agent && npm run dev`. The agent prints the
   pairing token to its console on first run, or you can copy it from the
   tray-menu &gt; *Copy pairing token* item.
2. In Chrome go to `chrome://extensions`.
3. Toggle **Developer mode** (top right).
4. Click **Load unpacked** and pick this directory (`extensions/chrome`).
5. Click the Vopro Capture toolbar button to open the popup.
6. Paste the pairing token, list the domains you want to capture (one per
   line, e.g. `app.salesforce.com`), and click **Save**.
7. Click **Test connection** — you should see `Paired with device …`.

## What gets captured

Per opted-in domain only:

- `navigation` — top-level URL changes
- `click` — clicks on links, buttons, menu items, submit inputs
- `form_submit` — form submissions
- `focus` — focus into an `<input>` / `<textarea>` / `contenteditable` (no
  values are read)

The extension never reads form values, page content beyond ARIA labels /
button text, or any cross-origin frame. Domains not in the opted-in list
are completely ignored — the content script returns immediately.

## What the agent does next

1. Re-runs the regex masking pass (emails, phone numbers, credit-card-shaped
   digit runs).
2. Buffers the events to `~/.vopro/events.jsonl`.
3. Flushes to `${VOPRO_API_BASE_URL}/api/v1/events/batch` every 30 s.

## Privacy notes

- The pairing token is local-only; it never leaves the device.
- The receiver listens on `127.0.0.1` only — it cannot be reached from the
  network.
- Events are batched and flushed lazily; pausing capture from the agent
  tray menu drops anything still in the buffer.
