import type { Connector, ConnectorConfig, ConnectorEvent } from '../types';

// Generic REST connector. Customers point us at an HTTPS endpoint that returns
// an array of `ConnectorEvent` JSON objects. Useful for ingesting from any
// proprietary internal tool.
export const GenericRestConnector: Connector = {
  id: 'rest',
  name: 'Generic REST',

  authorizeUrl(): string {
    throw new Error('Generic REST does not use OAuth. Provide an api_key in credentials.');
  },

  async exchangeCode(): Promise<Record<string, string>> {
    throw new Error('Generic REST does not use OAuth.');
  },

  async *pull(config: ConnectorConfig, since?: Date): AsyncIterable<ConnectorEvent> {
    const url = config.credentials.endpoint;
    const apiKey = config.credentials.api_key;
    if (!url) return;

    const params = new URLSearchParams();
    if (since) params.set('since', since.toISOString());
    const fullUrl = params.toString() ? `${url}?${params}` : url;

    const fetchFn = (await import('node-fetch')).default;
    const res = await fetchFn(fullUrl, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) return;
    const body = (await res.json()) as ConnectorEvent[];
    for (const event of body) {
      yield event;
    }
  },
};
