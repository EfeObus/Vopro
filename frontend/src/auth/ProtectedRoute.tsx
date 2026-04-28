import { Navigate, useLocation } from 'react-router-dom';
import type { ReactElement } from 'react';
import { useAuth } from './AuthContext';

export default function ProtectedRoute({ children }: { children: ReactElement }) {
  const { isAuthenticated, isHydrating } = useAuth();
  const location = useLocation();

  // While we're still verifying a stored token against /auth/me on cold boot,
  // hold off on redirecting — bouncing to /login here would clobber the user's
  // deep-linked URL even when their session is perfectly valid.
  if (isHydrating) {
    return (
      <div className="min-h-screen grid place-items-center text-ink-400 text-sm">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
