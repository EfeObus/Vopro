import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Copy,
  Download,
  EyeOff,
  FileCheck,
  Lock,
  Mail,
  Phone,
  Shield,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { cn } from '@/lib/cn';
import { api, ApiError, type CallRecordingRow, type WorkspaceSettings } from '@/lib/api';
import { readToken, useAuth } from '@/auth/AuthContext';
import type { Invitation, UserRole } from '@/types';

const DEFAULT_RULES = [
  { id: 'email', label: 'Email addresses', enabled: true },
  { id: 'phone', label: 'Phone numbers', enabled: true },
  { id: 'cc', label: 'Credit card numbers', enabled: true },
  { id: 'gov', label: 'Government IDs (SSN, NI, etc.)', enabled: true },
  { id: 'token', label: 'API keys & tokens', enabled: true },
  { id: 'password', label: 'Password fields', enabled: true },
];

function maskingRowsFromSettings(settings: WorkspaceSettings) {
  const byId = new Map((settings.masking_rules ?? []).map((r) => [r.id, r.enabled]));
  return DEFAULT_RULES.map((r) => ({
    ...r,
    enabled: byId.has(r.id) ? Boolean(byId.get(r.id)) : true,
  }));
}

export default function SettingsPage() {
  const [draft, setDraft] = useState<WorkspaceSettings | null>(null);
  const [loadingWs, setLoadingWs] = useState(true);
  const [savingWs, setSavingWs] = useState(false);
  const [wsMsg, setWsMsg] = useState<string | null>(null);
  const auth = useAuth();
  const isAdmin = auth.user?.role === 'admin';
  const [consentBusy, setConsentBusy] = useState(false);
  const needsCaptureConsent = Boolean(auth.user && auth.user.captureConsentAccepted !== true);

  const canUploadCalls = auth.user?.role === 'admin' || auth.user?.role === 'editor';
  const [callRows, setCallRows] = useState<CallRecordingRow[]>([]);
  const [callsLoading, setCallsLoading] = useState(true);
  const [callUploadBusy, setCallUploadBusy] = useState(false);
  const [callTitleHint, setCallTitleHint] = useState('');
  const [callMsg, setCallMsg] = useState<string | null>(null);

  const refreshCalls = useCallback(() => {
    return api
      .listCallRecordings()
      .then(setCallRows)
      .catch(() => setCallMsg('Could not load call recordings.'));
  }, []);

  useEffect(() => {
    void refreshCalls().finally(() => setCallsLoading(false));
  }, [refreshCalls]);

  useEffect(() => {
    const active = callRows.some((r) =>
      ['pending', 'transcribing', 'generating_sop'].includes(r.status),
    );
    if (!active) return;
    const t = window.setInterval(() => void refreshCalls(), 5000);
    return () => window.clearInterval(t);
  }, [callRows, refreshCalls]);

  useEffect(() => {
    api
      .getWorkspace()
      .then((w) => setDraft(w.settings))
      .catch(() => setWsMsg('Could not load workspace settings.'))
      .finally(() => setLoadingWs(false));
  }, []);

  function patchDraft(patch: Partial<WorkspaceSettings>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  function toggleMaskingRule(id: string) {
    if (!draft) return;
    const rows = maskingRowsFromSettings(draft);
    const next = rows.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    patchDraft({
      masking_rules: next.map(({ id: rid, enabled }) => ({ id: rid, enabled })),
    });
  }

  async function acceptCaptureConsent() {
    setConsentBusy(true);
    setWsMsg(null);
    try {
      await api.recordCaptureConsent();
      const token = readToken();
      if (token) {
        const fresh = await api.me();
        if (fresh) auth.acceptSession(token, fresh);
      }
      setWsMsg('Capture policy acknowledged.');
    } catch (e) {
      setWsMsg(e instanceof Error ? e.message : 'Could not save consent.');
    } finally {
      setConsentBusy(false);
    }
  }

  async function saveWorkspace() {
    if (!draft || !isAdmin) return;
    setSavingWs(true);
    setWsMsg(null);
    try {
      const next = await api.updateWorkspace(draft);
      setDraft(next.settings);
      setWsMsg('Saved.');
    } catch (e) {
      setWsMsg(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSavingWs(false);
    }
  }

  return (
    <div className="px-8 py-8 max-w-[1024px] mx-auto">
      <PageHeader
        title="Settings"
        subtitle="Privacy, capture, and workspace controls. Everything here is auditable."
      />

      {wsMsg && (
        <div className="mb-4 rounded-xl border border-ink-200 bg-ink-50 px-4 py-2 text-sm text-ink-700">
          {wsMsg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <Section icon={Shield} title="Capture" description="Choose where Vopro is allowed to observe.">
          {loadingWs || !draft ? (
            <div className="text-sm text-ink-400">Loading workspace…</div>
          ) : (
            <>
              <div className="py-2 flex items-center justify-between gap-4">
                <span className="text-sm text-ink-700">Capture from web applications</span>
                <Switch
                  checked={draft.capture_web_enabled}
                  disabled={!isAdmin}
                  onChange={() => patchDraft({ capture_web_enabled: !draft.capture_web_enabled })}
                />
              </div>
              <div className="py-2 flex items-center justify-between gap-4">
                <span className="text-sm text-ink-700">Capture from desktop applications</span>
                <Switch
                  checked={draft.capture_desktop_enabled}
                  disabled={!isAdmin}
                  onChange={() => patchDraft({ capture_desktop_enabled: !draft.capture_desktop_enabled })}
                />
              </div>
              <div className="py-2 flex items-center justify-between gap-4">
                <span className="text-sm text-ink-700">Capture from terminal sessions</span>
                <Switch
                  checked={draft.capture_terminal_enabled}
                  disabled={!isAdmin}
                  onChange={() => patchDraft({ capture_terminal_enabled: !draft.capture_terminal_enabled })}
                />
              </div>
              <div className="py-2 flex items-center justify-between gap-4">
                <span className="text-sm text-ink-700">Pause capture in private/incognito windows</span>
                <Switch
                  checked={draft.capture_pause_incognito}
                  disabled={!isAdmin}
                  onChange={() => patchDraft({ capture_pause_incognito: !draft.capture_pause_incognito })}
                />
              </div>
              {isAdmin && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" className="btn-primary" disabled={savingWs} onClick={() => void saveWorkspace()}>
                    {savingWs ? 'Saving…' : 'Save capture settings'}
                  </button>
                </div>
              )}
            </>
          )}
        </Section>

        {needsCaptureConsent && (
          <Section
            icon={FileCheck}
            title="Workflow capture consent"
            description="Confirm you have reviewed how capture works for your role. This is recorded for compliance."
          >
            <p className="text-sm text-ink-600 mb-4">
              By acknowledging, you confirm understanding of your organization&apos;s workflow capture settings above and
              applicable notices from your employer.
            </p>
            <button
              type="button"
              className="btn-primary"
              disabled={consentBusy}
              onClick={() => void acceptCaptureConsent()}
            >
              {consentBusy ? 'Saving…' : 'I acknowledge'}
            </button>
          </Section>
        )}

        <Section
          icon={EyeOff}
          title="On-device masking"
          description="Workspace defaults for what the agent scrubs before sync. Future agent builds read these flags from the API."
        >
          {!draft ? (
            <div className="text-sm text-ink-400">Loading workspace…</div>
          ) : (
            <>
              <ul className="divide-y divide-ink-100">
                {maskingRowsFromSettings(draft).map((r) => (
                  <li key={r.id} className="py-3 flex items-center justify-between">
                    <span className="text-sm text-ink-700">{r.label}</span>
                    <Switch
                      checked={r.enabled}
                      disabled={!isAdmin}
                      onChange={() => toggleMaskingRule(r.id)}
                    />
                  </li>
                ))}
              </ul>
              {isAdmin && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" className="btn-outline" disabled={savingWs} onClick={() => void saveWorkspace()}>
                    Save masking rules
                  </button>
                </div>
              )}
            </>
          )}
        </Section>

        <Section
          icon={Phone}
          title="Call recordings → SOPs"
          description="Upload support or operations call audio. We transcribe with Whisper, then draft a procedure you can edit under SOPs. Requires OPENAI_API_KEY on the server."
        >
          {callsLoading ? (
            <div className="text-sm text-ink-400">Loading…</div>
          ) : (
            <>
              {callMsg && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {callMsg}
                </div>
              )}
              {canUploadCalls ? (
                <div className="space-y-3 mb-6">
                  <label className="block">
                    <span className="text-xs font-medium text-ink-700">Optional title hint</span>
                    <input
                      type="text"
                      value={callTitleHint}
                      onChange={(e) => setCallTitleHint(e.target.value)}
                      placeholder="e.g. Billing dispute — refund policy"
                      className="mt-1 block w-full max-w-md rounded-lg border border-ink-200 px-3 py-2 text-sm"
                    />
                  </label>
                  <div>
                    <label className="btn-outline inline-flex cursor-pointer items-center gap-2">
                      <input
                        type="file"
                        accept=".flac,.m4a,.mp3,.mp4,.mpeg,.mpga,.oga,.ogg,.wav,.webm,audio/*"
                        className="hidden"
                        disabled={callUploadBusy}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (!file) return;
                          setCallUploadBusy(true);
                          setCallMsg(null);
                          void api
                            .uploadCallRecording(file, callTitleHint)
                            .then(() => refreshCalls())
                            .then(() => setCallMsg('Upload received — transcribing and drafting…'))
                            .catch((err) =>
                              setCallMsg(err instanceof ApiError ? err.message : 'Upload failed.'),
                            )
                            .finally(() => setCallUploadBusy(false));
                        }}
                      />
                      {callUploadBusy ? 'Uploading…' : 'Choose audio file'}
                    </label>
                    <p className="text-xs text-ink-500 mt-2">
                      Max ~24MB. Obtain consent where required. Audio is removed from servers after processing.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-ink-600 mb-4">
                  Only editors and admins can upload call audio. Ask an admin to grant access if needed.
                </p>
              )}
              <div className="border border-ink-100 rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-ink-50 text-xs font-medium text-ink-600">
                  <div className="col-span-3">Status</div>
                  <div className="col-span-5">Hint / detail</div>
                  <div className="col-span-4">Result</div>
                </div>
                {callRows.length === 0 ? (
                  <div className="px-3 py-6 text-sm text-ink-400 text-center">No uploads yet.</div>
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {callRows.map((row) => (
                      <li key={row.id} className="px-3 py-2.5 grid grid-cols-12 gap-2 text-sm">
                        <div className="col-span-3 text-ink-800 capitalize">{row.status.replace(/_/g, ' ')}</div>
                        <div className="col-span-5 text-ink-600 truncate" title={row.titleHint ?? ''}>
                          {row.titleHint ?? '—'}
                        </div>
                        <div className="col-span-4">
                          {row.sopId ? (
                            <Link to={`/sops/${row.sopId}`} className="text-brand-600 hover:underline text-sm">
                              Open draft SOP
                            </Link>
                          ) : row.status === 'failed' ? (
                            <span className="text-red-700 text-xs">{row.errorMessage ?? 'Failed'}</span>
                          ) : (
                            <span className="text-ink-400 text-xs">—</span>
                          )}
                          {row.transcriptRedacted ? (
                            <span className="block text-[11px] text-ink-400 mt-0.5">Transcript restricted for your role</span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </Section>

        <Section icon={Lock} title="Retention" description="How long raw events are kept before being purged.">
          {!draft ? (
            <div className="text-sm text-ink-400">Loading workspace…</div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={7}
                  max={90}
                  value={draft.event_retention_days}
                  disabled={!isAdmin}
                  onChange={(e) => patchDraft({ event_retention_days: Number(e.target.value) })}
                  className="flex-1"
                />
                <div className="font-semibold text-ink-900 w-24 text-right">{draft.event_retention_days} days</div>
              </div>
              <p className="text-sm text-ink-500 mt-3">
                Generated SOPs are retained indefinitely. Raw events older than {draft.event_retention_days} days are
                permanently deleted.
              </p>
              {isAdmin && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" className="btn-outline" disabled={savingWs} onClick={() => void saveWorkspace()}>
                    Save retention
                  </button>
                </div>
              )}
            </>
          )}
        </Section>

        {isAdmin && (
          <Section
            icon={Sparkles}
            title="Documentation automation"
            description="When pattern detection finds a brand-new workflow, optionally queue an SOP draft immediately."
          >
            {!draft ? (
              <div className="text-sm text-ink-400">Loading workspace…</div>
            ) : (
              <div className="py-2 flex items-center justify-between gap-4">
                <span className="text-sm text-ink-700">Auto-generate draft SOP for newly detected workflows</span>
                <Switch
                  checked={draft.auto_generate_sop}
                  onChange={() => patchDraft({ auto_generate_sop: !draft.auto_generate_sop })}
                  disabled={savingWs}
                />
              </div>
            )}
            {draft && isAdmin && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" className="btn-primary" disabled={savingWs} onClick={() => void saveWorkspace()}>
                  {savingWs ? 'Saving…' : 'Save automation'}
                </button>
              </div>
            )}
          </Section>
        )}

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
      } else if (err instanceof ApiError && err.code === 'domain_mismatch') {
        setError(
          'Invite email must use your workspace domain (the same domain you claimed at signup).',
        );
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

function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative w-10 h-6 rounded-full transition-colors',
        checked ? 'bg-brand-500' : 'bg-ink-200',
        disabled && 'opacity-50 cursor-not-allowed',
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
