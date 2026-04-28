import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Receiver } from '../src/receiver';
import { Capture } from '../src/capture';
import { EventBuffer } from '../src/buffer';
import type { AgentConfig } from '../src/types';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

function makeConfig(port: number, secret: string): AgentConfig {
  return {
    apiBaseUrl: 'http://localhost:3000',
    deviceId: 'device-1',
    capture: { enabled: true, optedInApps: ['app.salesforce.com'], pauseInPrivateBrowsing: true },
    masking: { enabled: true, customPatterns: [] },
    flushIntervalMs: 30_000,
    batchSize: 200,
    receiver: { enabled: true, port, sharedSecret: secret },
  };
}

describe('Receiver', () => {
  let receiver: Receiver;
  let capture: Capture;
  let bufferPath: string;
  const port = 17699;
  const secret = 'test-secret-abcdef';

  beforeEach(async () => {
    bufferPath = path.join(os.tmpdir(), `vopro-receiver-${Date.now()}.jsonl`);
    const buffer = new EventBuffer(bufferPath);
    const cfg = makeConfig(port, secret);
    capture = new Capture(cfg, buffer);
    receiver = new Receiver(cfg, capture);
    receiver.start();
    // Give the listener a tick to bind.
    await new Promise((r) => setTimeout(r, 30));
  });

  afterEach(async () => {
    receiver.stop();
    await fs.rm(bufferPath, { force: true });
  });

  it('rejects requests without the shared secret', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/events`, { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('serves /healthz unauthenticated', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/healthz`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });

  it('accepts a valid event batch and ignores invalid kinds', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Vopro-Token': secret },
      body: JSON.stringify({
        events: [
          { kind: 'click', application: 'app.salesforce.com', target: 'Save' },
          { kind: 'mystery', application: 'app.salesforce.com' },
          { kind: 'navigation', application: 'unknown.example' }, // not opted in → rejected
        ],
      }),
    });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { accepted: number; rejected: number };
    expect(body.accepted).toBe(1);
    expect(body.rejected).toBe(2);
  });
});
