// Service worker — buffers events from content scripts and POSTs to the
// local Vopro agent in batches. The agent is responsible for masking and
// forwarding to the backend.

const DEFAULTS = {
  receiverUrl: 'http://127.0.0.1:17654',
  pairingToken: '',
  optedInDomains: [], // e.g. ["app.salesforce.com", "trello.com"]
  flushIntervalMs: 5000,
  batchMax: 50,
};

let buffer = [];
let flushTimer = null;
let cfg = DEFAULTS;

async function loadConfig() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
  cfg = { ...DEFAULTS, ...stored };
}

function isOptedIn(url) {
  if (!url) return false;
  if (cfg.optedInDomains.length === 0) return false;
  try {
    const host = new URL(url).hostname;
    return cfg.optedInDomains.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

function applicationFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

function enqueue(event) {
  if (!cfg.pairingToken) return;
  buffer.push({ ...event, occurredAt: new Date().toISOString() });
  if (buffer.length >= cfg.batchMax) {
    void flush();
  } else {
    scheduleFlush();
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, cfg.flushIntervalMs);
}

async function flush() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, cfg.batchMax);
  try {
    const res = await fetch(`${cfg.receiverUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vopro-Token': cfg.pairingToken,
      },
      body: JSON.stringify({ events: batch }),
    });
    if (!res.ok) throw new Error(`receiver ${res.status}`);
  } catch (err) {
    // Re-buffer at the front so we don't lose events; bounded by batchMax * N.
    buffer = batch.concat(buffer).slice(0, 500);
    console.warn('[vopro] flush failed, will retry', err);
  }
}

void loadConfig();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  for (const key of Object.keys(changes)) {
    cfg[key] = changes[key].newValue;
  }
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId !== 0) return;
  if (!isOptedIn(details.url)) return;
  enqueue({
    kind: 'navigation',
    application: applicationFromUrl(details.url),
    url: details.url,
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'vopro:event' && msg.payload) {
    const url = sender.tab?.url || msg.payload.url;
    if (isOptedIn(url)) {
      enqueue({ ...msg.payload, application: msg.payload.application || applicationFromUrl(url) });
    }
  }
  if (msg?.type === 'vopro:flushNow') {
    void flush().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === 'vopro:getConfig') {
    sendResponse({ cfg, queued: buffer.length });
    return false;
  }
});

chrome.runtime.onInstalled.addListener(loadConfig);
