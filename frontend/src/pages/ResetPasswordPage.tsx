import { FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AuthCardLayout from '@/components/AuthCardLayout';
import { api, ApiError } from '@/lib/api';

const MIN = 12;

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < MIN) {
      setError(`Password must be at least ${MIN} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!token) {
      setError('Missing reset token. Request a new link.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      // 410 Gone is the canonical "token expired/used" response from the backend.
      if (err instanceof ApiError && err.status === 410) {
        setError('That reset link has expired or was already used. Request a new one.');
      } else {
        setError(err instanceof Error ? err.message : 'Could not reset password.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCardLayout
      title="Choose a new password"
      subtitle="Minimum 12 characters"
      footer={
        <Link to="/login" className="text-brand-600 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
          Password updated. Redirecting you to sign in…
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-ink-700">New password</span>
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
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      )}
    </AuthCardLayout>
  );
}
