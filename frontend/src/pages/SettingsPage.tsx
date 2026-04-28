import { FormEvent, useEffect, useState } from 'react';
import {
  AlertCircle,
  Copy,
  Download,
  EyeOff,
  Lock,
  Mail,
  Shield,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/cn';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import type { Invitation, UserRole } from '@/types';

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
  const auth = useAuth();
  const isAdmin = auth.user?.role === 'admin';

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

        {isAdmin && (
          <Section icon={Users} title="Team" description="Invite teammates to this workspace.">
            <InvitationsPanel />
          </Section>
        )}

        <Section
          icon={Download}
          title="Your data"
          description="GDPR export of everything we have on you, in machine-readable JSON."
        >
          <DataExportButton />
        </Section>

        <Section icon={Trash2} title="Danger zone" description="Irreversible actions.">
          <DeleteAccountPanel onDeleted={() => auth.logout()} />
        </Section>
      </div>
    </div>
  );
}

function InvitationsPanel() {
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('viewer');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<Invitation | null>(null);

  useEffect(() => {
    api
      .listInvitations()
      .then(setInvites)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load invitations.'))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await api.createInvitation(email.trim().toLowerCase(), role);
      setInvites((prev) => [created, ...prev]);
      setJustCreated(created);
      setEmail('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('A user with that email already exists in this workspace.');
      } else if (err instanceof ApiError && err.status === 422) {
        setError('Invalid email or role.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not create invitation.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function revoke(id: string) {
    const previous = invites;
    setInvites((prev) => prev.filter((i) => i.id !== id));
    try {
      await api.revokeInvitation(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke invitation.');
      setInvites(previous);
    }
  }

  function inviteUrl(t: string | undefined) {
    if (!t) return '';
    return `${window.location.origin}/invite/${t}`;
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2 mb-4">
        <label className="flex-1 min-w-[220px]">
          <span className="text-xs font-medium text-ink-700 flex items-center gap-1">
            <Mail className="size-3" /> Email
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="teammate@company.com"
          />
        </label>
        <label>
          <span className="text-xs font-medium text-ink-700">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className="mt-1 block rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button type="submit" disabled={submitting} className="btn-primary">
          <UserPlus className="size-4" />
          {submitting ? 'Sending…' : 'Invite'}
        </button>
      </form>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 mb-3">
          {error}
        </div>
      )}

      {justCreated?.token && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 mb-3 flex items-center gap-2">
          <span className="font-medium">Invite link:</span>
          <code className="flex-1 truncate">{inviteUrl(justCreated.token)}</code>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(inviteUrl(justCreated.token))}
            className="btn-outline py-1 px-2 text-xs"
          >
            <Copy className="size-3" />
            Copy
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-ink-400">Loading invitations…</div>
      ) : invites.length === 0 ? (
        <div className="text-sm text-ink-400">No outstanding invitations.</div>
      ) : (
        <ul className="divide-y divide-ink-100">
          {invites.map((inv) => (
            <li key={inv.id} className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink-900 truncate">{inv.email}</div>
                <div className="text-xs text-ink-500">
                  {inv.role} · expires {new Date(inv.expiresAt).toLocaleDateString()}
                  {inv.acceptedAt && ' · accepted'}
                  {inv.revokedAt && ' · revoked'}
                </div>
              </div>
              {!inv.acceptedAt && !inv.revokedAt && (
                <button onClick={() => revoke(inv.id)} className="btn-outline text-rose-600 border-rose-200 hover:bg-rose-50">
                  <X className="size-4" />
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DataExportButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportData() {
    setBusy(true);
    setError(null);
    try {
      const blob = await api.exportMyData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vopro-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button onClick={exportData} disabled={busy} className="btn-outline">
        <Download className="size-4" />
        {busy ? 'Preparing…' : 'Download my data'}
      </button>
      {error && (
        <div role="alert" className="mt-2 text-xs text-red-700 flex items-center gap-1">
          <AlertCircle className="size-3" /> {error}
        </div>
      )}
    </div>
  );
}

function DeleteAccountPanel({ onDeleted }: { onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function performDelete() {
    setBusy(true);
    setError(null);
    try {
      await api.deleteMyAccount();
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="btn-outline text-red-600 border-red-200 hover:bg-red-50"
      >
        <Trash2 className="size-4" />
        Delete my account and all my data
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-700">
        This permanently anonymises your user record and removes your captured events. Type{' '}
        <span className="font-mono font-semibold">delete</span> to confirm.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="flex-1 min-w-[160px] rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
          placeholder="delete"
          autoFocus
        />
        <button
          onClick={performDelete}
          disabled={busy || confirmText !== 'delete'}
          className="btn-primary bg-red-600 hover:bg-red-700 disabled:opacity-40"
        >
          {busy ? 'Deleting…' : 'Confirm'}
        </button>
        <button
          onClick={() => {
            setConfirming(false);
            setConfirmText('');
          }}
          className="btn-outline"
        >
          Cancel
        </button>
      </div>
      {error && (
        <div role="alert" className="text-xs text-red-700 flex items-center gap-1">
          <AlertCircle className="size-3" /> {error}
        </div>
      )}
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
