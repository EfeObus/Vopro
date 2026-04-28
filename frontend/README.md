# Vopro Frontend

React 18 + TypeScript + Vite + Tailwind dashboard for Vopro.

## Develop

```bash
npm install
npm run dev
```

Visit <http://localhost:5173>.

The dashboard ships with realistic mock data (`src/data/mock.ts`) so it works
fully offline. Set `VITE_API_BASE_URL` to point at the live Rails API once it's
running.

**Call recordings → SOPs:** under **Settings**, editors can upload audio; the
backend transcribes (Whisper) and generates a draft SOP. Live microphone capture
from this web app is not implemented—the Electron agent handles screen/event
capture separately (`../agent/README.md`).

## Test

```bash
npm test
```

## Build

```bash
npm run build
```
