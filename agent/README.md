# Vopro Agent

Electron + TypeScript desktop capture agent.

## Run

```bash
npm install
npm run start
```

The agent runs as a tray app. Capture is **disabled by default**; users
explicitly opt in per application.

## Privacy boundary

This agent is the trust boundary. All events go through:
1. `src/masking.ts` — regex-based PII masking
2. Persistent JSONL buffer (`~/.vopro/events.jsonl`)
3. Batched HTTPS sync to the backend

See `../docs/PRIVACY.md` for the full guarantees.

## Layout

```
src/
├── main.ts        # Electron main process
├── preload.ts     # Context bridge
├── capture.ts     # Event ingestion + masking
├── masking.ts     # PII rules
├── buffer.ts      # JSONL append-only buffer
├── sync.ts        # Batched POST to /api/v1/events/batch
└── config.ts      # electron-store settings
ui/index.html      # Tray popover UI
```

## Test

```bash
npm test
```
