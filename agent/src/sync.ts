import fetch, { type Response } from 'node-fetch';
import type { AgentConfig, CapturedEvent } from './types';
import { EventBuffer } from './buffer';

/**
 * Sync engine: ships buffered events to the Rails API with retries,
 * exponential backoff with jitter, and a dead-letter sink for poison
 * batches we can't deliver. The tray UI consumes `getStatus()` to show
 * a clear "syncing / paused / blocked" indicator.
 */

export type SyncStatus =
  | { state: 'idle'; lastSentAt?: string; pendingCount: number }
  | { state: 'syncing'; pendingCount: number }
  | {
      state: 'backoff';
      pendingCount: number;
      nextAttemptAt: string;
      attempts: number;
      reason: string;
    }
  | { state: 'auth_failed'; pendingCount: number; reason: string }
  | { state: 'dead_lettered'; pendingCount: number; lastError: string };

const BASE_BACKOFF_MS = 1_000;          // 1s
const MAX_BACKOFF_MS = 5 * 60_000;      // 5m
const MAX_ATTEMPTS = 8;                 // ~ 8 attempts ≈ 8.5 minutes total
const SHRINK_ON_413 = true;

export class Syncer {
  private timer: NodeJS.Timeout | null = null;
  private inflight = false;
  private attempts = 0;
  private backoffUntil = 0;
  private status: SyncStatus = { state: 'idle', pendingCount: 0 };
  private deadLetter: EventBuffer;
  private lastSentAt: string | undefined;

  constructor(
    private config: AgentConfig,
    private buffer: EventBuffer,
    deadLetter?: EventBuffer,
  ) {
    this.deadLetter = deadLetter ?? new EventBuffer(`${buffer.filePath}.deadletter`);
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.flush().catch((err) => console.error('[vopro] flush threw', err));
    }, this.config.flushIntervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getStatus(): SyncStatus {
    return this.status;
  }

  /**
   * Attempt one batch flush. Returns the count actually delivered.
   * Safe to call concurrently — overlapping calls become no-ops.
   */
  async flush(): Promise<{ sent: number }> {
    if (this.inflight) return { sent: 0 };
    if (Date.now() < this.backoffUntil) return { sent: 0 };

    this.inflight = true;
    try {
      const all = await this.buffer.readAll();
      if (all.length === 0) {
        this.status = { state: 'idle', lastSentAt: this.lastSentAt, pendingCount: 0 };
        return { sent: 0 };
      }

      const batch = all.slice(0, this.config.batchSize);
      const remaining = all.slice(this.config.batchSize);

      this.status = { state: 'syncing', pendingCount: all.length };

      const result = await this.postBatch(batch);

      if (result.kind === 'ok') {
        await this.buffer.replaceAll(remaining);
        this.attempts = 0;
        this.backoffUntil = 0;
        this.lastSentAt = new Date().toISOString();
        this.status = {
          state: 'idle',
          lastSentAt: this.lastSentAt,
          pendingCount: remaining.length,
        };
        return { sent: batch.length };
      }

      if (result.kind === 'auth_failed') {
        // Don't keep hammering the API with a bad token; surface to UI.
        this.status = { state: 'auth_failed', pendingCount: all.length, reason: result.reason };
        // Long backoff so we don't spam — operator must update the token.
        this.backoffUntil = Date.now() + 5 * 60_000;
        return { sent: 0 };
      }

      if (result.kind === 'poison') {
        // 4xx that isn't auth — server rejects this payload no matter how
        // many times we resend. Move to dead-letter so we never block on it.
        await this.deadLetter.appendMany(batch);
        await this.buffer.replaceAll(remaining);
        this.status = {
          state: 'dead_lettered',
          pendingCount: remaining.length,
          lastError: result.reason,
        };
        return { sent: 0 };
      }

      if (result.kind === 'too_large' && SHRINK_ON_413) {
        // Halve the batch on 413; if the offending event is single, dead-letter it.
        if (batch.length === 1) {
          await this.deadLetter.appendMany(batch);
          await this.buffer.replaceAll(remaining);
          this.status = {
            state: 'dead_lettered',
            pendingCount: remaining.length,
            lastError: result.reason,
          };
          return { sent: 0 };
        }
        // Re-write the buffer with a smaller front-batch by reducing the
        // configured batchSize for next attempt; the existing remaining tail
        // is preserved.
        this.config = { ...this.config, batchSize: Math.max(1, Math.floor(batch.length / 2)) };
        return this.scheduleRetry(result.reason, all.length);
      }

      // retryable (network or 5xx)
      return this.scheduleRetry(result.reason, all.length);
    } finally {
      this.inflight = false;
    }
  }

  private scheduleRetry(reason: string, pendingCount: number): { sent: number } {
    this.attempts += 1;
    if (this.attempts >= MAX_ATTEMPTS) {
      // Final failure: park current head batch in the dead-letter so the
      // pipeline can keep moving on subsequent flushes.
      void this.parkHeadBatch(reason);
      this.attempts = 0;
      this.backoffUntil = Date.now() + BASE_BACKOFF_MS;
      return { sent: 0 };
    }
    const delay = computeBackoff(this.attempts);
    this.backoffUntil = Date.now() + delay;
    this.status = {
      state: 'backoff',
      pendingCount,
      attempts: this.attempts,
      nextAttemptAt: new Date(this.backoffUntil).toISOString(),
      reason,
    };
    return { sent: 0 };
  }

  private async parkHeadBatch(reason: string): Promise<void> {
    try {
      const all = await this.buffer.readAll();
      const batch = all.slice(0, this.config.batchSize);
      const remaining = all.slice(this.config.batchSize);
      await this.deadLetter.appendMany(batch);
      await this.buffer.replaceAll(remaining);
      this.status = {
        state: 'dead_lettered',
        pendingCount: remaining.length,
        lastError: reason,
      };
    } catch (err) {
      console.error('[vopro] dead-letter park failed', err);
    }
  }

  private async postBatch(batch: CapturedEvent[]): Promise<PostResult> {
    let res: Response;
    try {
      res = await fetch(`${this.config.apiBaseUrl}/api/v1/events/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.workspaceToken
            ? { Authorization: `Bearer ${this.config.workspaceToken}` }
            : {}),
        },
        body: JSON.stringify({
          device_id: this.config.deviceId,
          events: batch.map(toServer),
        }),
      });
    } catch (err) {
      return { kind: 'retryable', reason: `network: ${(err as Error).message}` };
    }

    if (res.status >= 200 && res.status < 300) {
      return { kind: 'ok' };
    }
    if (res.status === 401 || res.status === 403) {
      return { kind: 'auth_failed', reason: `HTTP ${res.status}` };
    }
    if (res.status === 413) {
      return { kind: 'too_large', reason: `HTTP ${res.status}` };
    }
    if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
      // Client error other than auth / too-large / timeout / rate-limit:
      // server has decided this batch will never succeed.
      return { kind: 'poison', reason: `HTTP ${res.status}` };
    }
    // 408 / 429 / 5xx — retry with backoff.
    return { kind: 'retryable', reason: `HTTP ${res.status}` };
  }
}

type PostResult =
  | { kind: 'ok' }
  | { kind: 'retryable'; reason: string }
  | { kind: 'poison'; reason: string }
  | { kind: 'too_large'; reason: string }
  | { kind: 'auth_failed'; reason: string };

function toServer(e: CapturedEvent): Record<string, unknown> {
  return {
    kind: e.kind,
    application: e.application,
    url: e.url,
    target: e.target,
    payload: e.payload ?? {},
    occurred_at: e.occurredAt,
  };
}

/**
 * Exponential backoff with full jitter — see AWS Architecture Blog,
 * "Exponential Backoff and Jitter". `attempt` is 1-indexed.
 */
export function computeBackoff(attempt: number): number {
  const cap = MAX_BACKOFF_MS;
  const exp = Math.min(cap, BASE_BACKOFF_MS * 2 ** (attempt - 1));
  return Math.floor(Math.random() * exp);
}
