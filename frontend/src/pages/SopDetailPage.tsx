import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  Edit3,
  GitBranch,
  History,
  Save,
  Sparkles,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { api } from '@/lib/api';
import type { Sop } from '@/types';
import { formatDuration, formatPercent, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

export default function SopDetailPage() {
  const { id } = useParams();
  const [sop, setSop] = useState<Sop | undefined>();
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!id) return;
    void api.getSop(id).then(setSop);
  }, [id]);

  if (!sop) {
    return (
      <div className="px-8 py-8">
        <Link to="/sops" className="btn-ghost mb-6">
          <ArrowLeft className="size-4" /> Back to SOPs
        </Link>
        <div className="card p-12 text-center text-ink-400">Loading SOP…</div>
      </div>
    );
  }

  return (
    <div className="px-8 py-8 max-w-[1280px] mx-auto">
      <Link to="/sops" className="btn-ghost mb-6 -ml-2">
        <ArrowLeft className="size-4" /> Back to SOPs
      </Link>

      <PageHeader
        title={sop.title}
        subtitle={sop.description}
        actions={
          <div className="flex items-center gap-2">
            <button className="btn-outline">
              <Download className="size-4" /> Export
            </button>
            <button
              onClick={() => setEditing((e) => !e)}
              className={cn('btn-primary', editing && 'bg-emerald-600 hover:bg-emerald-700')}
            >
              {editing ? (
                <>
                  <Save className="size-4" /> Save
                </>
              ) : (
                <>
                  <Edit3 className="size-4" /> Edit
                </>
              )}
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-8">
        <StatusBadge status={sop.status} />
        {sop.tags.map((t) => (
          <span key={t} className="chip bg-ink-100 text-ink-600">
            {t}
          </span>
        ))}
        <span className="chip bg-brand-50 text-brand-700">
          <Sparkles className="size-3" /> AI confidence {formatPercent(sop.confidence)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <Stat label="Owner" value={sop.ownerName} />
        <Stat label="Avg duration" value={formatDuration(sop.averageDurationSec)} />
        <Stat label="Runs observed" value={sop.runsObserved.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 card p-6">
          <h2 className="text-lg font-semibold text-ink-900 mb-1">Steps</h2>
          <p className="text-sm text-ink-500 mb-6">
            Generated from {sop.runsObserved} captured runs. Decision branches reflect what we
            actually observed in different conditions.
          </p>

          <ol className="space-y-4">
            {sop.steps.map((step) => (
              <li key={step.id} className="flex gap-4">
                <div className="shrink-0">
                  {step.decision ? (
                    <div className="size-8 rounded-full bg-amber-100 text-amber-700 grid place-items-center font-semibold text-sm">
                      <GitBranch className="size-4" />
                    </div>
                  ) : (
                    <div className="size-8 rounded-full bg-brand-50 text-brand-700 grid place-items-center font-semibold text-sm">
                      {step.order}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-3">
                    {editing ? (
                      <input className="input font-medium" defaultValue={step.title} />
                    ) : (
                      <h3 className="font-semibold text-ink-900">{step.title}</h3>
                    )}
                    {step.application && (
                      <span className="chip bg-ink-100 text-ink-500">{step.application}</span>
                    )}
                  </div>
                  {editing ? (
                    <textarea className="input mt-2 min-h-[60px]" defaultValue={step.description} />
                  ) : (
                    <p className="text-sm text-ink-600 mt-1">{step.description}</p>
                  )}

                  {step.decision && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                      <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-2">
                        Decision
                      </div>
                      <div className="text-sm text-amber-900 mb-2">{step.decision.question}</div>
                      <div className="flex flex-wrap gap-2">
                        {step.decision.branches.map((b) => (
                          <span key={b.label} className="chip bg-white text-amber-800 border border-amber-200">
                            → {b.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="space-y-4">
          <section className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <History className="size-4 text-ink-500" />
              <h3 className="font-semibold text-ink-900">Version history</h3>
            </div>
            <ol className="relative border-l border-ink-200 ml-2 space-y-4">
              {sop.versions.map((v) => (
                <li key={v.id} className="ml-4">
                  <div className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full bg-brand-500" />
                  <div className="text-xs text-ink-400">
                    v{v.version} · {formatRelative(v.authoredAt)} · {v.authoredBy}
                  </div>
                  <div className="text-sm text-ink-700 mt-1">{v.summary}</div>
                </li>
              ))}
            </ol>
          </section>

          <section className="card p-5">
            <h3 className="font-semibold text-ink-900 mb-3">Why this SOP exists</h3>
            <p className="text-sm text-ink-600">
              Vopro detected this pattern from {sop.runsObserved} actual runs across{' '}
              {sop.contributors} teammates over the last 30 days. Updates are proposed
              automatically when the underlying workflow drifts.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-ink-400 font-medium">{label}</div>
      <div className="text-lg font-semibold text-ink-900 mt-1">{value}</div>
    </div>
  );
}
