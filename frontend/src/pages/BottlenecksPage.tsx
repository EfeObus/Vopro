import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Timer, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import PageHeader from '@/components/PageHeader';
import { api } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import type { BottleneckRow } from '@/types';

type SortKey = 'spread' | 'occurrences' | 'avg' | 'outlier';

const SORTS: { id: SortKey; label: string; description: string }[] = [
  { id: 'spread', label: 'Worst-case overrun', description: 'Outlier minus average' },
  { id: 'outlier', label: 'Slowest run', description: 'Outlier duration' },
  { id: 'avg', label: 'Slowest typical', description: 'Average duration' },
  { id: 'occurrences', label: 'Most observed', description: 'Number of runs captured' },
];

export default function BottlenecksPage() {
  const [rows, setRows] = useState<BottleneckRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('spread');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    api
      .bottlenecks()
      .then((data) => {
        setRows(data);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => {
    const next = [...rows];
    next.sort((a, b) => {
      switch (sort) {
        case 'spread':
          return b.outlierDurationSec - b.avgDurationSec - (a.outlierDurationSec - a.avgDurationSec);
        case 'outlier':
          return b.outlierDurationSec - a.outlierDurationSec;
        case 'avg':
          return b.avgDurationSec - a.avgDurationSec;
        case 'occurrences':
          return b.occurrences - a.occurrences;
      }
    });
    return next;
  }, [rows, sort]);

  const chartData = useMemo(
    () =>
      sorted.slice(0, 10).map((r) => ({
        // Recharts truncates long labels; trim here so the bar chart stays readable.
        name: r.workflow.length > 28 ? `${r.workflow.slice(0, 26)}…` : r.workflow,
        full: r.workflow,
        avg: Math.round(r.avgDurationSec / 60),
        outlier: Math.round(r.outlierDurationSec / 60),
        spread: Math.round((r.outlierDurationSec - r.avgDurationSec) / 60),
      })),
    [sorted],
  );

  const focused = selected ? rows.find((r) => r.workflow === selected) : null;
  const totalRuns = rows.reduce((s, r) => s + r.occurrences, 0);

  return (
    <div className="px-8 py-8 max-w-[1280px] mx-auto">
      <PageHeader
        title="Process bottlenecks"
        subtitle="Where the same workflow takes dramatically longer than usual. Click a row to drill in."
      />

      {error && (
        <div role="alert" className="card p-3 mb-4 text-sm text-rose-700 bg-rose-50 border-rose-200 flex items-center gap-2">
          <AlertCircle className="size-4" />
          {error}
        </div>
      )}

      {/* Top-line summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <SummaryCard icon={Timer} label="Tracked workflows" value={rows.length.toString()} />
        <SummaryCard icon={TrendingUp} label="Total runs analysed" value={totalRuns.toLocaleString()} />
        <SummaryCard
          icon={AlertCircle}
          label="Worst overrun"
          value={
            rows.length === 0
              ? '—'
              : formatDuration(
                  Math.max(...rows.map((r) => r.outlierDurationSec - r.avgDurationSec)),
                )
          }
        />
      </div>

      {/* Sort tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {SORTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            className={
              sort === s.id
                ? 'chip bg-brand-600 text-white'
                : 'chip bg-ink-100 text-ink-600 hover:bg-ink-200'
            }
            title={s.description}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card p-5">
          <h2 className="font-semibold text-ink-900 mb-4">Top 10 (minutes)</h2>
          <div className="h-72">
            {loading ? (
              <div className="h-full grid place-items-center text-ink-400 text-sm">Loading…</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
                  <CartesianGrid stroke="#eef0f5" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Tooltip
                    formatter={(v: number) => `${v}m`}
                    labelFormatter={(_label, payload) => payload?.[0]?.payload?.full ?? ''}
                  />
                  <Bar dataKey="avg" name="Average" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="outlier" name="Outlier" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.full}
                        fill={selected === entry.full ? '#dc2626' : '#f97316'}
                        cursor="pointer"
                        onClick={() => setSelected(entry.full)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <aside className="card p-5">
          <h2 className="font-semibold text-ink-900 mb-2">Drilldown</h2>
          {focused ? (
            <dl className="text-sm space-y-2">
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-500">Workflow</dt>
                <dd className="font-medium text-ink-900">{focused.workflow}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-500">Average</dt>
                <dd>{formatDuration(focused.avgDurationSec)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-500">Outlier</dt>
                <dd className="text-rose-700 font-medium">
                  {formatDuration(focused.outlierDurationSec)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-500">Overrun vs typical</dt>
                <dd>
                  {formatDuration(focused.outlierDurationSec - focused.avgDurationSec)}{' '}
                  <span className="text-ink-400">
                    ({Math.round((focused.outlierDurationSec / focused.avgDurationSec - 1) * 100)}%
                    slower)
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-500">Runs observed</dt>
                <dd>{focused.occurrences.toLocaleString()}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-ink-400">
              Select a row in the table or a bar in the chart to inspect a workflow.
            </p>
          )}
        </aside>
      </div>

      {/* Full table */}
      <section className="card mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-ink-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="text-left px-4 py-3">Workflow</th>
              <th className="text-right px-4 py-3">Average</th>
              <th className="text-right px-4 py-3">Outlier</th>
              <th className="text-right px-4 py-3">Overrun</th>
              <th className="text-right px-4 py-3">Runs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {sorted.map((r) => (
              <tr
                key={r.workflow}
                onClick={() => setSelected(r.workflow)}
                className={
                  selected === r.workflow
                    ? 'bg-brand-50 cursor-pointer'
                    : 'hover:bg-ink-50 cursor-pointer'
                }
              >
                <td className="px-4 py-3 font-medium text-ink-900">{r.workflow}</td>
                <td className="px-4 py-3 text-right">{formatDuration(r.avgDurationSec)}</td>
                <td className="px-4 py-3 text-right text-rose-700">
                  {formatDuration(r.outlierDurationSec)}
                </td>
                <td className="px-4 py-3 text-right">
                  +{formatDuration(r.outlierDurationSec - r.avgDurationSec)}
                </td>
                <td className="px-4 py-3 text-right">{r.occurrences.toLocaleString()}</td>
              </tr>
            ))}
            {!loading && sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-400">
                  No bottleneck data yet — capture a few workflows and check back.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

interface SummaryCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

function SummaryCard({ icon: Icon, label, value }: SummaryCardProps) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className="size-9 rounded-lg bg-brand-50 text-brand-600 grid place-items-center shrink-0">
        <Icon className="size-4" />
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-ink-500">{label}</div>
        <div className="font-semibold text-ink-900">{value}</div>
      </div>
    </div>
  );
}
