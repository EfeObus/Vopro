import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Users, Activity } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { api } from '@/lib/api';
import type { Sop, SopStatus } from '@/types';
import { formatDuration, formatPercent, formatRelative } from '@/lib/format';
import { cn } from '@/lib/cn';

const FILTERS: { id: SopStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'needs_review', label: 'Needs review' },
  { id: 'draft', label: 'Drafts' },
];

export default function SopListPage() {
  const [sops, setSops] = useState<Sop[]>([]);
  const [filter, setFilter] = useState<SopStatus | 'all'>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    void api.listSops().then(setSops);
  }, []);

  const filtered = useMemo(() => {
    return sops.filter((s) => {
      const matchesFilter = filter === 'all' || s.status === filter;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        s.title.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q));
      return matchesFilter && matchesQuery;
    });
  }, [sops, filter, query]);

  return (
    <div className="px-8 py-8 max-w-[1280px] mx-auto">
      <PageHeader
        title="SOP Library"
        subtitle="Every SOP Vopro has generated and curated for your team."
        actions={
          <button className="btn-primary">
            <Plus className="size-4" />
            New SOP
          </button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="size-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or tag…"
            className="input pl-9"
          />
        </div>
        <div className="flex gap-1 p-1 bg-white rounded-lg border border-ink-200">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition',
                filter === f.id
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-ink-500 hover:text-ink-800',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((sop) => (
          <Link
            to={`/sops/${sop.id}`}
            key={sop.id}
            className="card p-5 hover:border-brand-300 transition-colors"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-ink-900 truncate">{sop.title}</h3>
                <p className="text-sm text-ink-500 line-clamp-2 mt-1">{sop.description}</p>
              </div>
              <StatusBadge status={sop.status} />
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {sop.tags.map((tag) => (
                <span key={tag} className="chip bg-ink-100 text-ink-600">
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-ink-500">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Users className="size-3.5" />
                  {sop.contributors}
                </span>
                <span className="flex items-center gap-1">
                  <Activity className="size-3.5" />
                  {sop.runsObserved} runs
                </span>
                <span>~{formatDuration(sop.averageDurationSec)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-brand-600 font-medium">
                  {formatPercent(sop.confidence)} confidence
                </span>
                <span>updated {formatRelative(sop.lastUpdated)}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="card p-12 text-center text-ink-400">
          No SOPs match your filters.
        </div>
      )}
    </div>
  );
}
