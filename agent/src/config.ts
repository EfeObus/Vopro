import Store from 'electron-store';
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
};

export function loadConfig(): { config: AgentConfig; save: (next: Partial<AgentConfig>) => void } {
  const store = new Store<AgentConfig>({ name: 'vopro-agent', defaults: DEFAULTS });
  return {
    config: store.store,
    save: (next) => {
      const merged = { ...store.store, ...next };
      store.store = merged;
    },
  };
}
