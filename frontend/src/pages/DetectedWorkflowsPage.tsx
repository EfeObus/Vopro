import { useEffect, useState } from 'react';
import { AlertCircle, Check, Sparkles, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import type { DetectedWorkflow } from '@/types';
import { formatPercent, formatRelative } from '@/lib/format';

export default function DetectedWorkflowsPage() {
  const [items, setItems] = useState<DetectedWorkflow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.listDetected().then(setItems);
  }, []);

  async function dismiss(id: string) {
    const previous = items;
    // Optimistic update so the row reacts instantly even on a slow API.
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'dismissed' } : i)));
    setBusyId(id);
    try {
      const updated = await api.dismissWorkflow(id);
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not dismiss workflow.');
      setItems(previous);
    } finally {
      setBusyId(null);
    }
  }

  async function generate(id: string) {
    setBusyId(id);
    try {
      await api.generateSopFromWorkflow(id);
      // Backend enqueues a Sidekiq job; we mark the row optimistically so the
      // user gets feedback even before the job has processed.
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: 'sop_generated' } : i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not queue SOP generation.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="px-8 py-8 max-w-[1280px] mx-auto">
      <PageHeader
        title="Detected workflows"
        subtitle="Repeatable patterns Vopro found in your team's activity. Approve to generate an SOP, or dismiss to ignore."
      />

      {error && (
        <div role="alert" className="card p-3 mb-4 text-sm text-rose-700 bg-rose-50 border-rose-200 flex items-center gap-2">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const busy = busyId === item.id;
          return (
            <div key={item.id} className="card p-5 flex items-center gap-4">
              <div className="size-10 rounded-lg bg-brand-50 text-brand-600 grid place-items-center shrink-0">
                <Sparkles className="size-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-ink-900 truncate">{item.title}</h3>
                  <span className="chip bg-brand-50 text-brand-700">
                    {formatPercent(item.confidence)}
                  </span>
                </div>
                <div className="text-sm text-ink-500">
                  {item.application} · {item.occurrences} runs · last seen {formatRelative(item.lastSeen)}
                </div>
              </div>

              {item.status === 'pending' && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => dismiss(item.id)} disabled={busy} className="btn-outline">
                    <X className="size-4" /> Dismiss
                  </button>
                  <button onClick={() => generate(item.id)} disabled={busy} className="btn-primary">
                    <Check className="size-4" /> {busy ? 'Generating…' : 'Generate SOP'}
                  </button>
                </div>
              )}
              {item.status === 'sop_generated' && (
                <span className="chip bg-emerald-100 text-emerald-700 shrink-0">SOP generated</span>
              )}
              {item.status === 'dismissed' && (
                <span className="chip bg-ink-100 text-ink-500 shrink-0">Dismissed</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
