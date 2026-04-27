import { useEffect, useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import type { DetectedWorkflow } from '@/types';
import { formatPercent, formatRelative } from '@/lib/format';

export default function DetectedWorkflowsPage() {
  const [items, setItems] = useState<DetectedWorkflow[]>([]);

  useEffect(() => {
    void api.listDetected().then(setItems);
  }, []);

  function update(id: string, status: DetectedWorkflow['status']) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  }

  return (
    <div className="px-8 py-8 max-w-[1280px] mx-auto">
      <PageHeader
        title="Detected workflows"
        subtitle="Repeatable patterns Vopro found in your team's activity. Approve to generate an SOP, or dismiss to ignore."
      />

      <div className="space-y-3">
        {items.map((item) => (
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
                <button onClick={() => update(item.id, 'dismissed')} className="btn-outline">
                  <X className="size-4" /> Dismiss
                </button>
                <button onClick={() => update(item.id, 'sop_generated')} className="btn-primary">
                  <Check className="size-4" /> Generate SOP
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
        ))}
      </div>
    </div>
  );
}
