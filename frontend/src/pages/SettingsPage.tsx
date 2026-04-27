import { useState } from 'react';
import { Lock, Shield, EyeOff, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/cn';

const DEFAULT_RULES = [
  { id: 'email', label: 'Email addresses', enabled: true },
  { id: 'phone', label: 'Phone numbers', enabled: true },
  { id: 'cc', label: 'Credit card numbers', enabled: true },
  { id: 'gov', label: 'Government IDs (SSN, NI, etc.)', enabled: true },
  { id: 'token', label: 'API keys & tokens', enabled: true },
  { id: 'password', label: 'Password fields', enabled: true },
];

export default function SettingsPage() {
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [retention, setRetention] = useState(30);

  function toggle(id: string) {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    );
  }

  return (
    <div className="px-8 py-8 max-w-[1024px] mx-auto">
      <PageHeader
        title="Settings"
        subtitle="Privacy, capture, and workspace controls. Everything here is auditable."
      />

      <div className="grid grid-cols-1 gap-4">
        <Section icon={Shield} title="Capture" description="Choose where Vopro is allowed to observe.">
          <Toggle label="Capture from web applications" defaultChecked />
          <Toggle label="Capture from desktop applications" defaultChecked />
          <Toggle label="Capture from terminal sessions" />
          <Toggle label="Pause capture in private/incognito windows" defaultChecked />
        </Section>

        <Section icon={EyeOff} title="On-device masking" description="Masking is applied before events leave your machine.">
          <ul className="divide-y divide-ink-100">
            {rules.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between">
                <span className="text-sm text-ink-700">{r.label}</span>
                <Switch checked={r.enabled} onChange={() => toggle(r.id)} />
              </li>
            ))}
          </ul>
        </Section>

        <Section icon={Lock} title="Retention" description="How long raw events are kept before being purged.">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={7}
              max={90}
              value={retention}
              onChange={(e) => setRetention(Number(e.target.value))}
              className="flex-1"
            />
            <div className="font-semibold text-ink-900 w-24 text-right">{retention} days</div>
          </div>
          <p className="text-sm text-ink-500 mt-3">
            Generated SOPs are retained indefinitely. Raw events older than {retention} days are
            permanently deleted.
          </p>
        </Section>

        <Section icon={Trash2} title="Danger zone" description="Irreversible actions.">
          <button className="btn-outline text-red-600 border-red-200 hover:bg-red-50">
            Delete all my captured data
          </button>
        </Section>
      </div>
    </div>
  );
}

interface SectionProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}

function Section({ icon: Icon, title, description, children }: SectionProps) {
  return (
    <section className="card p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className="size-9 rounded-lg bg-brand-50 text-brand-600 grid place-items-center shrink-0">
          <Icon className="size-4" />
        </div>
        <div>
          <h2 className="font-semibold text-ink-900">{title}</h2>
          <p className="text-sm text-ink-500">{description}</p>
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(!!defaultChecked);
  return (
    <div className="py-2 flex items-center justify-between">
      <span className="text-sm text-ink-700">{label}</span>
      <Switch checked={checked} onChange={() => setChecked((v) => !v)} />
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={cn(
        'relative w-10 h-6 rounded-full transition-colors',
        checked ? 'bg-brand-500' : 'bg-ink-200',
      )}
      aria-pressed={checked}
    >
      <span
        className={cn(
          'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform',
          checked && 'translate-x-4',
        )}
      />
    </button>
  );
}
