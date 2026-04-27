export interface ConnectorEvent {
  kind: string;
  application: string;
  url?: string;
  target?: string;
  payload?: Record<string, unknown>;
  occurredAt: string;
}

export interface ConnectorConfig {
  workspaceId: string;
  credentials: Record<string, string>;
  scopes?: string[];
}

export interface Connector {
  readonly id: string;
  readonly name: string;
  authorizeUrl(redirectUri: string, state: string): string;
  exchangeCode(code: string, redirectUri: string): Promise<Record<string, string>>;
  pull(config: ConnectorConfig, since?: Date): AsyncIterable<ConnectorEvent>;
}
