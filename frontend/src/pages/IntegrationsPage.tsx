import { useCallback, useEffect, useState } from 'react';
import { Cloud, Check, AlertCircle } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import type { Integration, IntegrationProvider } from '@/types';

interface ProviderMeta {
  id: IntegrationProvider;
  name: string;
  description: string;
  /** True when the backend supports an OAuth `start` flow for this provider. */
  oauth: boolean;
}

const PROVIDERS: ProviderMeta[] = [
  { id: 'google',     name: 'Google Workspace', description: 'Drive, Docs, Calendar, Gmail',         oauth: true  },
  { id: 'microsoft',  name: 'Microsoft 365',    description: 'Outlook, OneDrive, Teams, SharePoint', oauth: true  },
  { id: 'salesforce', name: 'Salesforce',       description: 'Opportunities, Accounts, Cases',       oauth: false },
  { id: 'zendesk',    name: 'Zendesk',          description: 'Support tickets and macros',           oauth: false },
  { id: 'notion',     name: 'Notion',           description: 'Pages, databases, comments',           oauth: false },
  { id: 'slack',      name: 'Slack',            description: 'Channels and direct messages (opt-in)', oauth: false },
  { id: 'rest',       name: 'Generic REST',     description: 'Bring your own webhook source',        oauth: false },
];

interface RowState {
  meta: ProviderMeta;
  record: Integration | undefined;
  busy: boolean;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyProvider, setBusyProvider] = useState<IntegrationProvider | null>(null);
  const [restEndpoint, setRestEndpoint] = useState('');
  const [restKey, setRestKey] = useState('');

  const refresh = useCallback(() => {
    setLoading(true);
    api
      .listIntegrations()
      .then((rows) => {
        setIntegrations(rows);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const rest = integrations.find((i) => i.provider === 'rest');
    const ep = rest?.settings?.endpoint;
    if (typeof ep === 'string') setRestEndpoint(ep);
  }, [integrations]);

  // Listen for the OAuth popup's postMessage so the list refreshes the
  // moment a connection completes — no manual page reload required.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; ok?: boolean } | undefined;
      if (data?.type === 'vopro:integration-callback' && data.ok) {
        refresh();
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [refresh]);

  async function connect(provider: IntegrationProvider) {
    setBusyProvider(provider);
    try {
      const { url } = await api.startOAuth(provider);
      window.open(url, 'vopro-oauth', 'width=520,height=640');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start OAuth flow.');
    } finally {
      setBusyProvider(null);
    }
  }

  async function connectRest() {
    if (!restEndpoint.trim()) {
      setError('Enter the HTTPS endpoint that returns workflow events JSON.');
      return;
    }
    setBusyProvider('rest');
    setError(null);
    try {
      await api.createIntegration({
        provider: 'rest',
        status: 'connected',
        settings: { endpoint: restEndpoint.trim() },
        secrets: { api_key: restKey.trim() },
      });
      setRestEndpoint('');
      setRestKey('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save REST integration.');
    } finally {
      setBusyProvider(null);
    }
  }

  async function saveRestIntegration(record: Integration) {
    if (!restEndpoint.trim()) {
      setError('Enter the HTTPS endpoint that returns workflow events JSON.');
      return;
    }
    setBusyProvider('rest');
    setError(null);
    try {
      await api.updateIntegration(record.id, {
        settings: {
          ...record.settings,
          endpoint: restEndpoint.trim(),
        },
        ...(restKey.trim() ? { secrets: { api_key: restKey.trim() } } : {}),
      });
      setRestKey('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update REST integration.');
    } finally {
      setBusyProvider(null);
    }
  }

  async function disconnect(record: Integration) {
    setBusyProvider(record.provider);
    try {
      await api.disconnectIntegration(record.id);
      setIntegrations((prev) => prev.filter((r) => r.id !== record.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to disconnect.');
    } finally {
      setBusyProvider(null);
    }
  }

  const rows: RowState[] = PROVIDERS.map((meta) => ({
    meta,
    record: integrations.find((i) => i.provider === meta.id),
    busy: busyProvider === meta.id,
  }));

  return (
    <div className="px-8 py-8 max-w-[1280px] mx-auto">
      <PageHeader
        title="Integrations"
        subtitle="Connect Vopro to the systems your team already uses. Capture happens on-device with masking applied before any data leaves the agent. Google Workspace and Microsoft 365 use OAuth today; Generic REST is ready for custom pipelines. Other providers show Coming soon while connectors are built — ask us if you need one prioritized."
      />

      {error && (
        <div role="alert" className="card p-3 mb-4 text-sm text-rose-700 bg-rose-50 border-rose-200 flex items-center gap-2">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      {loading && integrations.length === 0 ? (
        <div className="card p-8 text-center text-ink-400">Loading integrations…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map(({ meta, record, busy }) => {
            const isConnected = record?.status === 'connected';
            return (
              <div key={meta.id} className="card p-5 flex items-center gap-4">
                <div className="size-10 rounded-lg bg-ink-100 grid place-items-center shrink-0">
                  <Cloud className="size-5 text-ink-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink-900">{meta.name}</div>
                  <div className="text-sm text-ink-500">{meta.description}</div>
                </div>
                {meta.id === 'rest' ? (
                  <div className="flex flex-col items-stretch gap-2 max-w-[min(100%,280px)] w-full">
                    <input
                      type="url"
                      placeholder="https://api.internal/events"
                      value={restEndpoint}
                      onChange={(e) => setRestEndpoint(e.target.value)}
                      className="w-full rounded-lg border border-ink-200 px-2 py-1.5 text-xs"
                      disabled={busy}
                    />
                    <input
                      type="password"
                      placeholder={isConnected ? 'New API key (optional)' : 'Bearer token (optional)'}
                      value={restKey}
                      onChange={(e) => setRestKey(e.target.value)}
                      className="w-full rounded-lg border border-ink-200 px-2 py-1.5 text-xs"
                      disabled={busy}
                    />
                    {isConnected && record ? (
                      <div className="flex flex-col gap-2 w-full">
                        <button
                          type="button"
                          onClick={() => void saveRestIntegration(record)}
                          disabled={busy}
                          className="btn-primary w-full text-xs py-1.5"
                        >
                          {busy ? 'Saving…' : 'Save changes'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void disconnect(record)}
                          disabled={busy}
                          className="btn-outline w-full text-xs py-1.5 justify-center"
                        >
                          {busy ? 'Disconnecting…' : 'Disconnect'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void connectRest()}
                        disabled={busy}
                        className="btn-primary w-full text-xs py-1.5"
                      >
                        {busy ? 'Saving…' : 'Connect REST'}
                      </button>
                    )}
                  </div>
                ) : isConnected ? (
                  <button
                    onClick={() => record && disconnect(record)}
                    disabled={busy}
                    className="btn-outline"
                  >
                    <Check className="size-4 text-emerald-600" />
                    {busy ? 'Disconnecting…' : 'Connected'}
                  </button>
                ) : meta.oauth ? (
                  <button
                    onClick={() => connect(meta.id)}
                    disabled={busy}
                    className="btn-primary"
                  >
                    {busy ? 'Connecting…' : 'Connect'}
                  </button>
                ) : (
                  <button disabled className="btn-outline opacity-60">
                    Coming soon
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
