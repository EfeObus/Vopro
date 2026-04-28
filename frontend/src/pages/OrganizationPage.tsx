import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Building2, Copy, Loader2, ShieldCheck } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { api, ApiError, type OrganizationSnapshot } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';

export default function OrganizationPage() {
  const { user } = useAuth();
  const [org, setOrg] = useState<OrganizationSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'idle' | 'start' | 'verify'>('idle');
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const o = await api.getOrganization();
      setOrg(o);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load organization.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (user?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  async function startDns() {
    setBusy('start');
    setNotice(null);
    try {
      await api.startDnsVerification();
      await load();
      setNotice('DNS token refreshed. Add or update the TXT record below, then verify.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start DNS verification.');
    } finally {
      setBusy('idle');
    }
  }

  async function verifyDns() {
    setBusy('verify');
    setNotice(null);
    try {
      const next = await api.verifyDns();
      setOrg(next);
      setNotice(next.domainVerified ? 'Domain verified successfully.' : 'DNS record not found yet — try again shortly.');
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) {
        setNotice(e.message);
      } else {
        setError(e instanceof ApiError ? e.message : 'Verification failed.');
      }
    } finally {
      setBusy('idle');
    }
  }

  function copy(text: string | null | undefined) {
    if (!text) return;
    void navigator.clipboard?.writeText(text);
    setNotice('Copied to clipboard.');
  }

  return (
    <div className="px-8 py-8 max-w-[960px] mx-auto">
      <PageHeader
        title="Organization"
        subtitle="Domain verification, billing plan, and seat usage for your workspace."
      />

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
          {notice}
        </div>
      )}

      {loading || !org ? (
        <div className="flex items-center gap-2 text-sm text-ink-500">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid gap-4">
          <section className="card p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="size-9 rounded-lg bg-brand-50 text-brand-600 grid place-items-center shrink-0">
                <Building2 className="size-4" />
              </div>
              <div>
                <h2 className="font-semibold text-ink-900">{org.name}</h2>
                <p className="text-sm text-ink-500">
                  Slug <span className="font-mono text-ink-700">{org.slug}</span>
                  {org.claimedDomain && (
                    <>
                      {' · '}
                      Domain <span className="font-mono text-ink-700">{org.claimedDomain}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-ink-100 px-3 py-2">
                <dt className="text-ink-400 text-xs uppercase tracking-wide">Plan</dt>
                <dd className="font-medium text-ink-900 capitalize">{org.billingPlan.replace(/_/g, ' ')}</dd>
              </div>
              <div className="rounded-lg border border-ink-100 px-3 py-2">
                <dt className="text-ink-400 text-xs uppercase tracking-wide">Trial</dt>
                <dd className="font-medium text-ink-900">
                  {org.trialActive && org.trialEndsAt
                    ? `Ends ${new Date(org.trialEndsAt).toLocaleDateString()}`
                    : org.trialActive
                      ? 'Active'
                      : 'Not active'}
                </dd>
              </div>
              <div className="rounded-lg border border-ink-100 px-3 py-2">
                <dt className="text-ink-400 text-xs uppercase tracking-wide">Seats</dt>
                <dd className="font-medium text-ink-900">
                  {org.seatsUsed} / {org.seatsLimit}
                </dd>
              </div>
              <div className="rounded-lg border border-ink-100 px-3 py-2 flex items-start gap-2">
                <ShieldCheck className={`size-4 mt-0.5 shrink-0 ${org.domainVerified ? 'text-emerald-600' : 'text-amber-500'}`} />
                <div>
                  <dt className="text-ink-400 text-xs uppercase tracking-wide">Domain verified</dt>
                  <dd className="font-medium text-ink-900">
                    {org.domainVerified
                      ? org.domainVerifiedAt
                        ? new Date(org.domainVerifiedAt).toLocaleString()
                        : 'Yes'
                      : 'Pending'}
                  </dd>
                </div>
              </div>
            </dl>
          </section>

          {!org.domainVerified && (
            <section className="card p-6">
              <h2 className="font-semibold text-ink-900 mb-2">Verify domain (DNS)</h2>
              <p className="text-sm text-ink-500 mb-4">
                Publish a TXT record at the host below. When DNS propagates, click verify. You can refresh the token if needed.
              </p>

              <div className="space-y-3 mb-4">
                <div>
                  <div className="text-xs font-medium text-ink-500 mb-1">Host</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="flex-1 min-w-0 text-xs bg-ink-50 border border-ink-100 rounded px-2 py-1 break-all">
                      {org.dnsTxtHost ?? '—'}
                    </code>
                    <button type="button" className="btn-outline text-xs py-1" onClick={() => copy(org.dnsTxtHost)}>
                      <Copy className="size-3" /> Copy
                    </button>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-ink-500 mb-1">Value</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="flex-1 min-w-0 text-xs bg-ink-50 border border-ink-100 rounded px-2 py-1 break-all">
                      {org.dnsTxtValue ?? 'Start verification to generate a token.'}
                    </code>
                    <button type="button" className="btn-outline text-xs py-1" onClick={() => copy(org.dnsTxtValue)}>
                      <Copy className="size-3" /> Copy
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-outline" disabled={busy !== 'idle'} onClick={() => void startDns()}>
                  {busy === 'start' ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Working…
                    </>
                  ) : (
                    'Generate / refresh DNS token'
                  )}
                </button>
                <button type="button" className="btn-primary" disabled={busy !== 'idle'} onClick={() => void verifyDns()}>
                  {busy === 'verify' ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Checking…
                    </>
                  ) : (
                    'Verify DNS'
                  )}
                </button>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
