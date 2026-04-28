import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { isAuthenticated } = useAuth();

  const [status, setStatus] = useState<'idle' | 'working' | 'ok' | 'err'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('err');
      setMessage('Missing verification token.');
      return;
    }
    let cancelled = false;
    setStatus('working');
    api
      .verifySignupEmail(token)
      .then(() => {
        if (!cancelled) {
          setStatus('ok');
          setMessage('Your email domain is verified.');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setStatus('err');
          setMessage(err instanceof ApiError ? err.message : 'Verification failed.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token && status !== 'err') {
    return (
      <div className="min-h-screen grid place-items-center bg-ink-50 px-4">
        <div className="text-sm text-ink-600">Missing token.</div>
      </div>
    );
  }

  if (token && (status === 'idle' || status === 'working')) {
    return (
      <div className="min-h-screen grid place-items-center bg-ink-50 px-4">
        <div className="text-sm text-ink-600">Verifying…</div>
      </div>
    );
  }

  if (status === 'ok') {
    return <Navigate to={isAuthenticated ? '/' : '/login'} replace state={{ verifiedEmail: true }} />;
  }

  return (
    <div className="min-h-screen grid place-items-center bg-ink-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-ink-100 shadow-soft p-8 text-center">
        <p className="text-sm text-red-700 mb-4">{message ?? 'Verification failed.'}</p>
        <Link to="/login" className="text-sm text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
