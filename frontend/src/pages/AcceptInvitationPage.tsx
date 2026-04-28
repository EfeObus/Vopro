import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AuthCardLayout from '@/components/AuthCardLayout';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';
import type { InvitationPreview } from '@/types';

const MIN = 12;

export default function AcceptInvitationPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { acceptSession } = useAuth();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setPreviewError('Missing invitation token.');
      setLoading(false);
      return;
    }
    api
      .previewInvitation(token)
      .then((p) => setPreview(p))
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 410) {
          setPreviewError('This invitation has expired or already been used.');
        } else {
          setPreviewError(err instanceof Error ? err.message : 'Could not load invitation.');
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (password.length < MIN) {
      setError(`Password must be at least ${MIN} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.acceptInvitation(token, { name: name.trim(), password });
      acceptSession(result.token, result.user);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) {
        setError('This invitation has expired or already been used.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not accept invitation.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AuthCardLayout title="Loading invitation…" subtitle="One moment">
        <div className="h-12 grid place-items-center text-ink-400 text-sm">Verifying your invite…</div>
      </AuthCardLayout>
    );
  }

  if (previewError || !preview) {
    return (
      <AuthCardLayout
        title="Invitation unavailable"
        subtitle="This link won't work"
        footer={
          <Link to="/login" className="text-brand-600 hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700">
          {previewError ?? 'Unknown error.'}
        </div>
      </AuthCardLayout>
    );
  }

  return (
    <AuthCardLayout
      title={`Join ${preview.workspaceName}`}
      subtitle={`Invited as ${preview.role}`}
      footer={
        <Link to="/login" className="text-brand-600 hover:underline">
          Already have an account? Sign in
        </Link>
      }
    >
      <p className="text-sm text-ink-500 mb-4">
        Setting up account for <span className="font-medium text-ink-900">{preview.email}</span>.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-ink-700">Your name</span>
          <input
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-ink-700">Password</span>
          <input
            type="password"
            required
            minLength={MIN}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-ink-700">Confirm password</span>
          <input
            type="password"
            required
            minLength={MIN}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-ink-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </label>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full justify-center disabled:opacity-50">
          {submitting ? 'Creating account…' : 'Accept and continue'}
        </button>
      </form>
    </AuthCardLayout>
  );
}
