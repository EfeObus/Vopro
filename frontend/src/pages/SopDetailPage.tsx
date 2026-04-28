import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Download,
  Edit3,
  GitBranch,
  History,
  Plus,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { api } from '@/lib/api';
import type { Sop, SopStep } from '@/types';
import { formatDuration, formatPercent, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

export default function SopDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sop, setSop] = useState<Sop | undefined>();
  const [editing, setEditing] = useState(false);
  const [busyAction, setBusyAction] = useState<
    'publish' | 'archive' | 'export-md' | 'export-pdf' | 'save' | 'delete' | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftSteps, setDraftSteps] = useState<SopStep[]>([]);

  useEffect(() => {
    if (!id) return;
    void api.getSop(id).then((s) => {
      setSop(s);
      if (s) {
        setDraftTitle(s.title);
        setDraftDescription(s.description);
        setDraftSteps(s.steps);
      }
    });
  }, [id]);

  function reorderStep(index: number, direction: -1 | 1) {
    setDraftSteps((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
  }

  function patchStep(index: number, patch: Partial<SopStep>) {
    setDraftSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeStep(index: number) {
    setDraftSteps((prev) =>
      prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i + 1 })),
    );
  }

  function addStep() {
    setDraftSteps((prev) => [
      ...prev,
      {
        id: `step-${Date.now().toString(36)}`,
        order: prev.length + 1,
        title: 'New step',
        description: '',
      },
    ]);
  }

  async function publish() {
    if (!sop) return;
    setBusyAction('publish');
    try {
      const { status } = await api.publishSop(sop.id);
      setSop({ ...sop, status });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed.');
    } finally {
      setBusyAction(null);
    }
  }

  async function archive() {
    if (!sop) return;
    setBusyAction('archive');
    try {
      const { status } = await api.archiveSop(sop.id);
      setSop({ ...sop, status });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Archive failed.');
    } finally {
      setBusyAction(null);
    }
  }

  async function deletePermanently() {
    if (!sop) return;
    const ok = window.confirm(
      'Permanently delete this SOP? This removes all versions and cannot be undone.',
    );
    if (!ok) return;
    setBusyAction('delete');
    try {
      await api.deleteSop(sop.id);
      navigate('/sops');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setBusyAction(null);
    }
  }

  function slugifyFilename(title: string, fallbackId: string): string {
    const raw = title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '');
    return raw.slice(0, 120) || fallbackId;
  }

  async function exportSop(format: 'markdown' | 'pdf') {
    if (!sop) return;
    setBusyAction(format === 'markdown' ? 'export-md' : 'export-pdf');
    try {
      const blob = await api.exportSop(sop.id, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'markdown' ? 'md' : 'pdf';
      a.download = `${slugifyFilename(sop.title, sop.id)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusyAction(null);
    }
  }

  async function saveEdits() {
    if (!sop) return;
    setBusyAction('save');
    try {
      const updated = await api.updateSop(
        sop.id,
        { title: draftTitle, description: draftDescription, steps: draftSteps },
        'Edited from detail page',
      );
      setSop(updated);
      setDraftSteps(updated.steps);
      setEditing(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusyAction(null);
    }
  }

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
            <button
              type="button"
              onClick={() => exportSop('markdown')}
              disabled={busyAction === 'export-md' || busyAction === 'export-pdf'}
              className="btn-outline"
              aria-label="Export as Markdown"
            >
              <Download className="size-4" />
              {busyAction === 'export-md' ? 'Markdown…' : 'Markdown'}
            </button>
            <button
              type="button"
              onClick={() => exportSop('pdf')}
              disabled={busyAction === 'export-md' || busyAction === 'export-pdf'}
              className="btn-outline"
              aria-label="Export as PDF"
            >
              <Download className="size-4" />
              {busyAction === 'export-pdf' ? 'PDF…' : 'PDF'}
            </button>
            {sop.status !== 'published' && (
              <button
                onClick={publish}
                disabled={busyAction === 'publish'}
                className="btn-outline"
              >
                <CheckCircle2 className="size-4 text-emerald-600" />
                {busyAction === 'publish' ? 'Publishing…' : 'Publish'}
              </button>
            )}
            {sop.status !== 'archived' && (
              <button
                onClick={archive}
                disabled={busyAction === 'archive'}
                className="btn-outline"
              >
                <Archive className="size-4" />
                {busyAction === 'archive' ? 'Archiving…' : 'Archive'}
              </button>
            )}
            <button
              type="button"
              onClick={() => void deletePermanently()}
              disabled={busyAction === 'delete'}
              className="btn-outline border-rose-200 text-rose-700 hover:bg-rose-50"
              aria-label="Delete SOP permanently"
            >
              <Trash2 className="size-4" />
              {busyAction === 'delete' ? 'Deleting…' : 'Delete'}
            </button>
            <button
              onClick={() => (editing ? saveEdits() : setEditing(true))}
              disabled={busyAction === 'save'}
              className={cn('btn-primary', editing && 'bg-emerald-600 hover:bg-emerald-700')}
            >
              {editing ? (
                <>
                  <Save className="size-4" /> {busyAction === 'save' ? 'Saving…' : 'Save'}
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

      {error && (
        <div role="alert" className="card p-3 mb-4 text-sm text-rose-700 bg-rose-50 border-rose-200 flex items-center gap-2">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

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

      {editing && (
        <div className="card p-4 mb-6 space-y-3">
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-ink-500 font-medium">
              Title
            </span>
            <input
              className="input mt-1 w-full"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wider text-ink-500 font-medium">
              Description
            </span>
            <textarea
              className="input mt-1 w-full min-h-[80px]"
              value={draftDescription}
              onChange={(e) => setDraftDescription(e.target.value)}
            />
          </label>
          <p className="text-xs text-ink-400">
            Edits to title, description, and the steps below are all sent in one Save.
          </p>
        </div>
      )}

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
            {(editing ? draftSteps : sop.steps).map((step, index) => (
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
                      <input
                        className="input font-medium flex-1"
                        value={step.title}
                        onChange={(e) => patchStep(index, { title: e.target.value })}
                        aria-label={`Step ${step.order} title`}
                      />
                    ) : (
                      <h3 className="font-semibold text-ink-900">{step.title}</h3>
                    )}
                    {step.application && !editing && (
                      <span className="chip bg-ink-100 text-ink-500">{step.application}</span>
                    )}
                  </div>
                  {editing ? (
                    <textarea
                      className="input mt-2 min-h-[60px] w-full"
                      value={step.description}
                      onChange={(e) => patchStep(index, { description: e.target.value })}
                      aria-label={`Step ${step.order} description`}
                    />
                  ) : (
                    <p className="text-sm text-ink-600 mt-1">{step.description}</p>
                  )}
                  {editing && (
                    <input
                      className="input mt-2 w-full text-sm"
                      placeholder="Application (e.g. Salesforce)"
                      value={step.application ?? ''}
                      onChange={(e) => patchStep(index, { application: e.target.value || undefined })}
                      aria-label={`Step ${step.order} application`}
                    />
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
                      {editing && (
                        <p className="text-xs text-amber-700 mt-2">
                          Decision branches are auto-generated; edit by re-running SOP generation
                          on the source workflow.
                        </p>
                      )}
                    </div>
                  )}

                  {editing && (
                    <div className="flex items-center gap-1 mt-2">
                      <button
                        type="button"
                        onClick={() => reorderStep(index, -1)}
                        disabled={index === 0}
                        className="btn-outline py-1 px-2 text-xs disabled:opacity-40"
                        aria-label={`Move step ${step.order} up`}
                      >
                        <ArrowUp className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => reorderStep(index, 1)}
                        disabled={index === draftSteps.length - 1}
                        className="btn-outline py-1 px-2 text-xs disabled:opacity-40"
                        aria-label={`Move step ${step.order} down`}
                      >
                        <ArrowDown className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeStep(index)}
                        className="btn-outline py-1 px-2 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                        aria-label={`Delete step ${step.order}`}
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {editing && (
            <button
              type="button"
              onClick={addStep}
              className="btn-outline mt-4 w-full justify-center"
            >
              <Plus className="size-4" />
              Add step
            </button>
          )}
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
