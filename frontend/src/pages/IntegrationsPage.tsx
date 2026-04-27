import { useState } from 'react';
import { Cloud, Check } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

interface Integration {
  id: string;
  name: string;
  description: string;
  connected: boolean;
}

const INITIAL: Integration[] = [
  { id: 'google', name: 'Google Workspace', description: 'Drive, Docs, Calendar, Gmail', connected: true },
  { id: 'microsoft', name: 'Microsoft 365', description: 'Outlook, OneDrive, Teams, SharePoint', connected: false },
  { id: 'salesforce', name: 'Salesforce', description: 'Opportunities, Accounts, Cases', connected: true },
  { id: 'zendesk', name: 'Zendesk', description: 'Support tickets and macros', connected: true },
  { id: 'notion', name: 'Notion', description: 'Pages, databases, comments', connected: false },
  { id: 'slack', name: 'Slack', description: 'Channels and direct messages (opt-in)', connected: true },
  { id: 'rest', name: 'Generic REST', description: 'Bring your own webhook source', connected: false },
];

export default function IntegrationsPage() {
  const [items, setItems] = useState(INITIAL);

  function toggle(id: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, connected: !i.connected } : i)));
  }

  return (
    <div className="px-8 py-8 max-w-[1280px] mx-auto">
      <PageHeader
        title="Integrations"
        subtitle="Connect Vopro to the systems your team already uses. Capture happens on-device with masking applied before any data leaves the agent."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((i) => (
          <div key={i.id} className="card p-5 flex items-center gap-4">
            <div className="size-10 rounded-lg bg-ink-100 grid place-items-center shrink-0">
              <Cloud className="size-5 text-ink-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-ink-900">{i.name}</div>
              <div className="text-sm text-ink-500">{i.description}</div>
            </div>
            <button
              onClick={() => toggle(i.id)}
              className={i.connected ? 'btn-outline' : 'btn-primary'}
            >
              {i.connected ? (
                <>
                  <Check className="size-4 text-emerald-600" /> Connected
                </>
              ) : (
                'Connect'
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
