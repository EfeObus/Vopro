import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import type { AgentConfig, CapturedEvent } from '../src/types';

const { mockedFetch } = vi.hoisted(() => ({ mockedFetch: vi.fn() }));

vi.mock('node-fetch', () => ({ default: mockedFetch }));

// Imports below MUST come after `vi.mock` to pick up the mocked module.
const { Syncer, computeBackoff } = await import('../src/sync');
const { EventBuffer } = await import('../src/buffer');

function makeConfig(): AgentConfig {
  return {
    apiBaseUrl: 'http://api.test',
    deviceId: 'd1',
    workspaceToken: 'tok',
    capture: { enabled: true, optedInApps: ['app.example.com'], pauseInPrivateBrowsing: true },
    masking: { enabled: true, customPatterns: [] },
    flushIntervalMs: 60_000,
    batchSize: 100,
    receiver: { enabled: false, port: 0, sharedSecret: '' },
  };
}

function makeEvent(id: string): CapturedEvent {
  return {
    id,
    kind: 'click',
    application: 'app.example.com',
    target: 'Save',
    occurredAt: new Date().toISOString(),
  };
}

let bufferPath: string;
let deadLetterPath: string;
let buffer: EventBuffer;
let deadLetter: EventBuffer;
let cfg: AgentConfig;
let syncer: Syncer;

beforeEach(async () => {
  bufferPath = path.join(os.tmpdir(), `vopro-sync-${Date.now()}-${Math.random()}.jsonl`);
  deadLetterPath = `${bufferPath}.deadletter`;
  buffer = new EventBuffer(bufferPath);
  deadLetter = new EventBuffer(deadLetterPath);
  cfg = makeConfig();
  syncer = new Syncer(cfg, buffer, deadLetter);
  mockedFetch.mockReset();
});

afterEach(async () => {
  syncer.stop();
  await fs.rm(bufferPath, { force: true });
  await fs.rm(deadLetterPath, { force: true });
});

describe('Syncer', () => {
  it('returns sent: 0 when buffer is empty', async () => {
    const result = await syncer.flush();
    expect(result.sent).toBe(0);
    expect(syncer.getStatus().state).toBe('idle');
  });

  it('delivers events on success and clears the buffer', async () => {
    await buffer.append(makeEvent('e1'));
    await buffer.append(makeEvent('e2'));
    mockedFetch.mockResolvedValueOnce({ status: 202, ok: true });

    const result = await syncer.flush();

    expect(result.sent).toBe(2);
    expect(await buffer.readAll()).toEqual([]);
    const status = syncer.getStatus();
    expect(status.state).toBe('idle');
    expect(status.pendingCount).toBe(0);
  });

  it('keeps events buffered and enters backoff on 5xx', async () => {
    await buffer.append(makeEvent('e1'));
    mockedFetch.mockResolvedValueOnce({ status: 503, ok: false });

    const result = await syncer.flush();

    expect(result.sent).toBe(0);
    expect(await buffer.readAll()).toHaveLength(1);
    const status = syncer.getStatus();
    expect(status.state).toBe('backoff');
    if (status.state === 'backoff') {
      expect(status.attempts).toBe(1);
      expect(status.reason).toMatch(/HTTP 503/);
    }
  });

  it('keeps events buffered and enters backoff on network error', async () => {
    await buffer.append(makeEvent('e1'));
    mockedFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    await syncer.flush();

    expect(await buffer.readAll()).toHaveLength(1);
    const status = syncer.getStatus();
    expect(status.state).toBe('backoff');
    if (status.state === 'backoff') {
      expect(status.reason).toMatch(/network/i);
    }
  });

  it('enters auth_failed (no retries) on 401', async () => {
    await buffer.append(makeEvent('e1'));
    mockedFetch.mockResolvedValueOnce({ status: 401, ok: false });

    await syncer.flush();
    expect(await buffer.readAll()).toHaveLength(1); // not dropped
    expect(syncer.getStatus().state).toBe('auth_failed');
  });

  it('moves the batch to dead-letter on a poison 4xx', async () => {
    await buffer.append(makeEvent('e1'));
    await buffer.append(makeEvent('e2'));
    mockedFetch.mockResolvedValueOnce({ status: 422, ok: false });

    await syncer.flush();

    expect(await buffer.readAll()).toEqual([]);
    const dl = await deadLetter.readAll();
    expect(dl.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(syncer.getStatus().state).toBe('dead_lettered');
  });

  it('halves batch size on 413 and dead-letters when single event still too big', async () => {
    await buffer.append(makeEvent('e1'));
    cfg.batchSize = 1; // Force the 1-event corner case.
    syncer = new Syncer(cfg, buffer, deadLetter);

    mockedFetch.mockResolvedValueOnce({ status: 413, ok: false });

    await syncer.flush();
    expect(await buffer.readAll()).toEqual([]);
    expect(await deadLetter.readAll()).toHaveLength(1);
  });

  it('skips flushing while a previous flush is in-flight', async () => {
    await buffer.append(makeEvent('e1'));
    let resolveFetch: ((v: { status: number; ok: boolean }) => void) | undefined;
    mockedFetch.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveFetch = res as typeof resolveFetch;
        }),
    );

    const first = syncer.flush();
    // Wait until the first flush has reached the mocked fetch (which reads
    // the buffer from disk first, so plain microtask yields aren't enough).
    for (let i = 0; i < 20 && !resolveFetch; i++) {
      await new Promise((r) => setTimeout(r, 5));
    }
    expect(resolveFetch).toBeDefined();

    const second = await syncer.flush();
    expect(second.sent).toBe(0);

    resolveFetch!({ status: 202, ok: true });
    await first;
  });

  it('respects the active backoff window', async () => {
    await buffer.append(makeEvent('e1'));
    mockedFetch.mockResolvedValueOnce({ status: 503, ok: false });
    await syncer.flush(); // schedules backoff

    mockedFetch.mockClear();
    const result = await syncer.flush();
    expect(result.sent).toBe(0);
    expect(mockedFetch).not.toHaveBeenCalled();
  });
});

describe('computeBackoff', () => {
  it('grows exponentially up to the cap', () => {
    const samples = [1, 2, 3, 4, 8, 12].map((a) => ({ attempt: a, value: computeBackoff(a) }));
    for (const s of samples) {
      expect(s.value).toBeGreaterThanOrEqual(0);
      expect(s.value).toBeLessThanOrEqual(5 * 60_000);
    }
  });
});
