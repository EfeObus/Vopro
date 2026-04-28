import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Clock,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { api } from '@/lib/api';
import type { AnalyticsPoint, BottleneckRow, DetectedWorkflow, Sop } from '@/types';
import { formatDuration, formatPercent, formatRelative } from '@/lib/format';

export default function OverviewPage() {
  const [sops, setSops] = useState<Sop[]>([]);
  const [detected, setDetected] = useState<DetectedWorkflow[]>([]);
  const [runsByDay, setRunsByDay] = useState<AnalyticsPoint[]>([]);
  const [bottlenecks, setBottlenecks] = useState<BottleneckRow[]>([]);

  useEffect(() => {
    void Promise.all([api.listSops(), api.listDetected(), api.analytics()]).then(
      ([s, d, a]) => {
        setSops(s);
        setDetected(d);
        setRunsByDay(a.runsByDay);
        setBottlenecks(a.bottlenecks);
      },
    );
  }, []);

  const totalRuns = runsByDay.reduce((acc, p) => acc + p.runs, 0);
  const publishedSops = sops.filter((s) => s.status === 'published').length;

  return (
    <div className="px-8 py-8 max-w-[1280px] mx-auto">
      <PageHeader
        title="Overview"
        subtitle="A snapshot of how work is happening across your team — and the documentation Vopro generated from it."
        actions={
          <Link to="/workflows" className="btn-primary">
            Review detected workflows
            <ArrowRight className="size-4" />
          </Link>
        }
      />

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={BookOpen} label="Published SOPs" value={String(publishedSops)} delta="+3 this week" tone="positive" />
        <StatCard icon={Sparkles} label="New patterns" value={String(detected.length)} delta="awaiting review" />
        <StatCard icon={Activity} label="Runs observed" value={totalRuns.toLocaleString()} delta="last 7 days" />
        <StatCard icon={Clock} label="Time saved (est.)" value="42h" delta="this month" tone="positive" />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-ink-900">Activity & coverage</h2>
              <p className="text-sm text-ink-500">Daily workflow runs and SOPs published.</p>
            </div>
            <span className="chip bg-brand-50 text-brand-700">
              <TrendingUp className="size-3.5" /> +18% vs prior week
            </span>
          </div>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={runsByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" vertical={false} />
                <XAxis dataKey="label" stroke="#7e889e" fontSize={12} />
                <YAxis stroke="#7e889e" fontSize={12} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, borderColor: '#dde1ea', fontSize: 12 }}
                  cursor={{ fill: 'rgba(74,100,245,0.06)' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="runs" name="Runs observed" fill="#4a64f5" radius={[6, 6, 0, 0]} />
                <Bar dataKey="sops" name="SOPs published" fill="#22c55e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-ink-900">Newly detected</h2>
              <p className="text-sm text-ink-500">Patterns ready for SOP review.</p>
            </div>
          </div>
          <ul className="divide-y divide-ink-100">
            {detected.slice(0, 4).map((d) => (
              <li key={d.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink-900 truncate">{d.title}</div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    {d.application} · {d.occurrences} runs · {formatRelative(d.lastSeen)}
                  </div>
                </div>
                <span className="chip bg-brand-50 text-brand-700 shrink-0">{formatPercent(d.confidence)}</span>
              </li>
            ))}
          </ul>
          <Link to="/workflows" className="btn-ghost mt-2 w-full justify-center">
            View all
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            <h2 className="font-semibold text-ink-900">Process bottlenecks</h2>
          </div>
          <Link to="/bottlenecks" className="text-sm text-brand-600 hover:underline">
            See full drilldown
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-ink-400 text-xs uppercase tracking-wider">
              <th className="font-medium pb-3">Workflow</th>
              <th className="font-medium pb-3">Avg duration</th>
              <th className="font-medium pb-3">Worst case</th>
              <th className="font-medium pb-3 text-right">Occurrences</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {bottlenecks.map((b) => (
              <tr key={b.workflow}>
                <td className="py-3 font-medium text-ink-900">{b.workflow}</td>
                <td className="py-3 text-ink-600">{formatDuration(b.avgDurationSec)}</td>
                <td className="py-3 text-red-600">{formatDuration(b.outlierDurationSec)}</td>
                <td className="py-3 text-right text-ink-600">{b.occurrences}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
