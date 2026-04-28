import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

const TOKEN_KEY = 'vopro.token';
const USER_KEY = 'vopro.user';

/**
 * Decode the `exp` claim of a JWT without verifying signature — purely so the
 * client can schedule a proactive refresh before the token actually expires.
 * Trust comes from the server validating the next request, not from us.
 */
function decodeExp(token: string): number | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
    ) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Refresh this many milliseconds before the JWT's `exp`. */
const REFRESH_LEAD_MS = 60_000;
/** Skip scheduling if the token expires sooner than this — already too late. */
const REFRESH_FLOOR_MS = 5_000;

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  workspaceId: string;
}

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** True until the boot-time `/auth/me` probe finishes. */
  isHydrating: boolean;
  login: (email: string, password: string) => Promise<void>;
  /**
   * Adopt a token + user issued by a non-login flow (e.g. invitation accept,
   * token refresh) and persist them as if the user had just signed in.
   */
  acceptSession: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

function safeRead<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : window.localStorage.getItem(TOKEN_KEY),
  );
  const [user, setUser] = useState<AuthUser | null>(() => safeRead<AuthUser>(USER_KEY));
  // Start hydrating only when there's a stored token to verify; otherwise the
  // user is plainly logged out and the LoginPage should render immediately.
  const [isHydrating, setIsHydrating] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(window.localStorage.getItem(TOKEN_KEY));
  });

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${BASE}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Login failed (${res.status})`);
    }
    const body = (await res.json()) as { token: string; user: AuthUser };
    setToken(body.token);
    setUser(body.user);
    window.localStorage.setItem(TOKEN_KEY, body.token);
    window.localStorage.setItem(USER_KEY, JSON.stringify(body.user));
  }, []);

  const acceptSession = useCallback((nextToken: string, nextUser: AuthUser) => {
    setToken(nextToken);
    setUser(nextUser);
    window.localStorage.setItem(TOKEN_KEY, nextToken);
    window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  }, []);

  const logout = useCallback(() => {
    const currentToken = window.localStorage.getItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));

    // Best-effort server-side revocation. We don't await it so logout is
    // instant in the UI even when offline; the local state is already cleared.
    if (currentToken && BASE) {
      fetch(`${BASE}/api/v1/auth/logout`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${currentToken}` },
        keepalive: true,
      }).catch(() => undefined);
    }
  }, []);

  // Listen for cross-tab logout signals so a 401 anywhere clears every tab,
  // plus same-tab dispatches from the api client when it sees a 401.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY && e.newValue === null) {
        setToken(null);
        setUser(null);
      }
    };
    const onLogout = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('vopro:auth-logout', onLogout);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('vopro:auth-logout', onLogout);
    };
  }, []);

  // Schedule a proactive refresh: ~60s before the JWT expires, swap the token
  // for a fresh one. The backend rotates and revokes the old jti, so even if
  // a request races with expiry the worst case is one 401 and the api client's
  // `clearAuth` kicks in. Scheduling lives in a ref so re-renders don't pile
  // up overlapping timers.
  const refreshTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (!token || !BASE) return;

    const exp = decodeExp(token);
    if (!exp) return;

    const msUntilExp = exp * 1000 - Date.now();
    const delay = msUntilExp - REFRESH_LEAD_MS;
    if (delay < REFRESH_FLOOR_MS) return;

    refreshTimerRef.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`${BASE}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const body = (await res.json()) as { token: string };
        setToken(body.token);
        window.localStorage.setItem(TOKEN_KEY, body.token);
      } catch {
        // network blip — the next protected request will surface a 401 and
        // the user will be bumped to /login cleanly.
      }
    }, delay);

    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [token]);

  // Boot-time hydration: if we picked up a token from localStorage, prove it
  // still resolves a user on the server. The backend will 401 if the token
  // was revoked or the user was GDPR-anonymised, in which case `clearAuth`
  // (called by the api client on 401) wipes local state.
  useEffect(() => {
    if (!isHydrating) return;
    if (!token || !BASE) {
      setIsHydrating(false);
      return;
    }
    let cancelled = false;
    fetch(`${BASE}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          const fresh = (await res.json()) as AuthUser;
          setUser(fresh);
          window.localStorage.setItem(USER_KEY, JSON.stringify(fresh));
        } else if (res.status === 401) {
          setToken(null);
          setUser(null);
          window.localStorage.removeItem(TOKEN_KEY);
          window.localStorage.removeItem(USER_KEY);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsHydrating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isHydrating, token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token),
      isHydrating,
      login,
      acceptSession,
      logout,
    }),
    [token, user, isHydrating, login, acceptSession, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export const AUTH_LOGOUT_EVENT = 'vopro:auth-logout';

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(AUTH_LOGOUT_EVENT));
}
