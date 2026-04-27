export type EventKind =
  | 'click'
  | 'input'
  | 'navigation'
  | 'focus'
  | 'blur'
  | 'form_submit'
  | 'shortcut'
  | 'copy'
  | 'paste'
  | 'open'
  | 'close';

export interface CapturedEvent {
  id: string;
  kind: EventKind;
  application?: string;
  url?: string;
  target?: string;
  payload?: Record<string, unknown>;
  occurredAt: string;
}

export interface AgentConfig {
  apiBaseUrl: string;
  deviceId: string;
  workspaceToken?: string;
  capture: {
    enabled: boolean;
    optedInApps: string[];
    pauseInPrivateBrowsing: boolean;
  };
  masking: {
    enabled: boolean;
    customPatterns: string[];
  };
  flushIntervalMs: number;
  batchSize: number;
}
