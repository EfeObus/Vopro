import Store from 'electron-store';
import { randomBytes } from 'node:crypto';
import { v4 as uuid } from 'uuid';
import type { AgentConfig } from './types';

const DEFAULTS: AgentConfig = {
  apiBaseUrl: process.env.VOPRO_API_BASE_URL ?? 'http://localhost:3000',
  deviceId: process.env.VOPRO_DEVICE_ID ?? uuid(),
  capture: {
    enabled: false,
    optedInApps: [],
    pauseInPrivateBrowsing: true,
  },
  masking: {
    enabled: true,
    customPatterns: [],
  },
  flushIntervalMs: 30_000,
  batchSize: 200,
  receiver: {
    enabled: true,
    port: Number(process.env.VOPRO_RECEIVER_PORT ?? 17654),
    sharedSecret: process.env.VOPRO_RECEIVER_SECRET ?? randomBytes(24).toString('hex'),
  },
};

// electron-store v10 ships imprecise types (Conf re-exports lose generic
// information). We treat the store as a loose key/value bag at the boundary
// and only expose AgentConfig to the rest of the agent.
interface KvStore {
  get<T>(key: string, fallback?: T): T;
  set(key: string, value: unknown): void;
}

export function loadConfig(): { config: AgentConfig; save: (next: Partial<AgentConfig>) => void } {
  const store = new Store<AgentConfig>({ name: 'vopro-agent', defaults: DEFAULTS }) as unknown as KvStore;
  const defaultsBag = DEFAULTS as unknown as Record<string, unknown>;
  const bag: Record<string, unknown> = { ...defaultsBag };
  for (const key of Object.keys(defaultsBag)) {
    bag[key] = store.get(key, defaultsBag[key]);
  }
  const config = bag as unknown as AgentConfig;
  return {
    config,
    save: (next) => {
      for (const [key, value] of Object.entries(next)) {
        store.set(key, value);
        bag[key] = value;
      }
    },
  };
}
