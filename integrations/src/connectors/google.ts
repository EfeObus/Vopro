import fetch from 'node-fetch';
import type { Connector, ConnectorConfig, ConnectorEvent } from '../types';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/calendar.readonly',
];

export const GoogleWorkspaceConnector: Connector = {
  id: 'google',
  name: 'Google Workspace',

  authorizeUrl(redirectUri: string, state: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      scope: SCOPES.join(' '),
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  },

  async exchangeCode(code: string, redirectUri: string): Promise<Record<string, string>> {
    const clientId = process.env.GOOGLE_CLIENT_ID ?? '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? '';
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
    return (await res.json()) as Record<string, string>;
  },

  async *pull(config: ConnectorConfig, since?: Date): AsyncIterable<ConnectorEvent> {
    const token = config.credentials.access_token;
    if (!token) return;

    const sinceParam = since ? `&pageSize=100&orderBy=modifiedTime desc&q=modifiedTime>'${since.toISOString()}'` : '';
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?fields=files(id,name,modifiedTime,webViewLink)${sinceParam}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const body = (await res.json()) as { files?: Array<{ id: string; name: string; modifiedTime: string; webViewLink: string }> };
    for (const file of body.files ?? []) {
      yield {
        kind: 'open',
        application: 'Google Drive',
        url: file.webViewLink,
        target: file.name,
        occurredAt: file.modifiedTime,
      };
    }
  },
};
