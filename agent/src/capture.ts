import { v4 as uuid } from 'uuid';
import type { AgentConfig, CapturedEvent, EventKind } from './types';
import { scrub } from './masking';
import { EventBuffer } from './buffer';

// Browser/desktop event hooks would be wired here. For the MVP we expose a
// programmatic ingress so the IPC layer (preload) and integration listeners
// can both feed in.
export class Capture {
  constructor(private config: AgentConfig, private buffer: EventBuffer) {}

  get enabled(): boolean {
    return this.config.capture.enabled;
  }

  isOptedIn(application?: string): boolean {
    if (!this.enabled) return false;
    if (!application) return false;
    return this.config.capture.optedInApps.includes(application);
  }

  async record(input: {
    kind: EventKind;
    application?: string;
    url?: string;
    target?: string;
    payload?: Record<string, unknown>;
  }): Promise<CapturedEvent | null> {
    if (!this.isOptedIn(input.application)) return null;

    const safe: CapturedEvent = {
      id: uuid(),
      kind: input.kind,
      application: input.application,
      url: input.url ? scrub(input.url) : undefined,
      target: input.target ? scrub(input.target) : undefined,
      payload: input.payload ? scrub(input.payload) : undefined,
      occurredAt: new Date().toISOString(),
    };

    await this.buffer.append(safe);
    return safe;
  }
}
