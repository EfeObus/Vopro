import fetch from 'node-fetch';
import type { AgentConfig, CapturedEvent } from './types';
import { EventBuffer } from './buffer';

export class Syncer {
  private timer: NodeJS.Timeout | null = null;

  constructor(private config: AgentConfig, private buffer: EventBuffer) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.flush().catch(console.error), this.config.flushIntervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async flush(): Promise<{ sent: number }> {
    const all = await this.buffer.readAll();
    if (all.length === 0) return { sent: 0 };

    const batch = all.slice(0, this.config.batchSize);
    const remaining = all.slice(this.config.batchSize);

    try {
      const res = await fetch(`${this.config.apiBaseUrl}/api/v1/events/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.workspaceToken
            ? { Authorization: `Bearer ${this.config.workspaceToken}` }
            : {}),
        },
        body: JSON.stringify({
          device_id: this.config.deviceId,
          captured_at: new Date().toISOString(),
          events: batch.map(toServer),
        }),
      });

      if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
      await this.buffer.replaceAll(remaining);
      return { sent: batch.length };
    } catch (err) {
      console.warn('[vopro] sync failed, retaining events for retry', err);
      return { sent: 0 };
    }
  }
}

function toServer(e: CapturedEvent) {
  return {
    kind: e.kind,
    application: e.application,
    url: e.url,
    target: e.target,
    payload: e.payload ?? {},
    occurred_at: e.occurredAt,
  };
}
