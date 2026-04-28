import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';

export default function SignupPage() {
  const { isAuthenticated, acceptSession } = useAuth();
  const navigate = useNavigate();

  const [workspaceName, setWorkspaceName] = useState('');
  const [slug, setSlug] = useState('');
  const [claimedDomain, setClaimedDomain] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.signup({
        workspaceName: workspaceName.trim(),
        slug: slug.trim() || undefined,
        claimedDomain: claimedDomain.trim().toLowerCase().replace(/^www\./, ''),
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim().toLowerCase(),
        adminPassword,
      });
      acceptSession(res.token, res.user);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.code) {
          case 'personal_email_not_allowed':
            setError(
              'Use your company email address to register a workspace. Consumer domains like Gmail or Yahoo are not accepted outside local development.',
            );
            break;
          case 'domain_mismatch':
            setError(
              'Your work email domain must match the organization domain you claimed (for example you@acme.com with claimed domain acme.com).',
            );
            break;
          default:
            setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Signup failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-ink-50 px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl border border-ink-100 shadow-soft p-8">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="size-9 rounded-lg bg-brand-600 grid place-items-center">
            <svg
              viewBox="0 0 24 24"
              className="size-5 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 8 L12 18 L19 6" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-ink-900 leading-tight">Create workspace</div>
            <div className="text-xs text-ink-400">Register your organization</div>
          </div>
        </div>

        <p className="text-sm text-ink-500 mb-6">
          {import.meta.env.DEV ? (
            <>
              Local development accepts personal or work emails; your workspace&apos;s claimed domain is taken from your email address if needed.
              After signup we send a verification link — you can prove ownership via DNS on{' '}
              <strong className="text-ink-700">Organization</strong>.
            </>
          ) : (
            <>
              Use your company email so it matches the domain you claim for your organization. After signup we send a verification link — you can also prove ownership via DNS on{' '}
              <strong className="text-ink-700">Organization</strong>.
            </>
          )}
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-ink-700">Workspace name</span>
            <input
              type="text"
              required
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="Acme Ops"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-700">Workspace slug (optional)</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="acme-ops"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-700">Claimed email domain</span>
            <input
              type="text"
              required
              value={claimedDomain}
              onChange={(e) => setClaimedDomain(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="company.com"
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-700">Your name</span>
            <input
              type="text"
              required
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="Jordan Lee"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-700">Work email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="you@company.com"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-ink-700">Password (min. 12 characters)</span>
            <input
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </label>

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full justify-center disabled:opacity-50">
            {submitting ? 'Creating workspace…' : 'Create workspace'}
          </button>

          <div className="text-center text-xs text-ink-500">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 hover:underline">
              Sign in
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
