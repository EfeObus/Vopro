import fetch from 'node-fetch';
import type { Connector, ConnectorConfig, ConnectorEvent } from '../types';

const SCOPES = ['offline_access', 'Files.Read', 'Calendars.Read', 'Mail.Read'];

export const Microsoft365Connector: Connector = {
  id: 'microsoft',
  name: 'Microsoft 365',

  authorizeUrl(redirectUri: string, state: string): string {
    const clientId = process.env.MICROSOFT_CLIENT_ID ?? '';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      response_mode: 'query',
      scope: SCOPES.join(' '),
      state,
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  },

  async exchangeCode(code: string, redirectUri: string): Promise<Record<string, string>> {
    const clientId = process.env.MICROSOFT_CLIENT_ID ?? '';
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET ?? '';
    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: SCOPES.join(' '),
      }).toString(),
    });
    if (!res.ok) throw new Error(`Microsoft token exchange failed: ${res.status}`);
    return (await res.json()) as Record<string, string>;
  },

  async *pull(config: ConnectorConfig, since?: Date): AsyncIterable<ConnectorEvent> {
    const token = config.credentials.access_token;
    if (!token) return;

    const filter = since ? `&$filter=lastModifiedDateTime ge ${since.toISOString()}` : '';
    const res = await fetch(`https://graph.microsoft.com/v1.0/me/drive/recent?$top=50${filter}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const body = (await res.json()) as { value?: Array<{ id: string; name: string; webUrl: string; lastModifiedDateTime: string }> };
    for (const item of body.value ?? []) {
      yield {
        kind: 'open',
        application: 'OneDrive',
        url: item.webUrl,
        target: item.name,
        occurredAt: item.lastModifiedDateTime,
      };
    }
  },
};
