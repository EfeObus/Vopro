import { cn } from '@/lib/cn';
import type { SopStatus } from '@/types';

const COLORS: Record<SopStatus, string> = {
  draft: 'bg-ink-100 text-ink-700',
  published: 'bg-emerald-100 text-emerald-700',
  needs_review: 'bg-amber-100 text-amber-800',
  archived: 'bg-ink-100 text-ink-500',
};

const LABELS: Record<SopStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  needs_review: 'Needs review',
  archived: 'Archived',
};

export default function StatusBadge({ status }: { status: SopStatus }) {
  return <span className={cn('chip', COLORS[status])}>{LABELS[status]}</span>;
}
