import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  delta?: string;
  tone?: 'positive' | 'negative' | 'neutral';
}

export default function StatCard({ icon: Icon, label, value, delta, tone = 'neutral' }: StatCardProps) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-600 bg-emerald-50'
      : tone === 'negative'
      ? 'text-red-600 bg-red-50'
      : 'text-ink-500 bg-ink-100';

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-400">{label}</span>
        <span className="size-8 rounded-lg bg-brand-50 text-brand-600 grid place-items-center">
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-3 text-2xl font-semibold text-ink-900">{value}</div>
      {delta && (
        <div className={`mt-2 inline-block text-xs font-medium px-2 py-0.5 rounded-full ${toneClass}`}>
          {delta}
        </div>
      )}
    </div>
  );
}
