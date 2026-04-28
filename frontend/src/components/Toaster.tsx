import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api';

export type ToastTone = 'info' | 'success' | 'warn' | 'error';

export interface Toast {
  id: string;
  tone: ToastTone;
  title: string;
  body?: string;
  /** Auto-dismiss in ms. 0 / undefined keeps it pinned. */
  ttlMs?: number;
}

interface ToasterApi {
  push: (t: Omit<Toast, 'id'>) => string;
  pushError: (err: unknown, fallback?: string) => string;
  dismiss: (id: string) => void;
  toasts: Toast[];
}

const ToasterContext = createContext<ToasterApi | null>(null);

export function ToasterProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (t: Omit<Toast, 'id'>): string => {
      const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { ...t, id }]);
      const ttl = t.ttlMs ?? (t.tone === 'error' ? 0 : 4000);
      if (ttl > 0) {
        setTimeout(() => dismiss(id), ttl);
      }
      return id;
    },
    [dismiss],
  );

  const pushError = useCallback(
    (err: unknown, fallback = 'Something went wrong'): string => {
      if (err instanceof ApiError) {
        return push({
          tone: 'error',
          title: prettyTitleFor(err),
          body: err.requestId ? `Request id: ${err.requestId}` : err.message,
        });
      }
      return push({
        tone: 'error',
        title: fallback,
        body: err instanceof Error ? err.message : String(err),
      });
    },
    [push],
  );

  const value = useMemo<ToasterApi>(
    () => ({ push, pushError, dismiss, toasts }),
    [push, pushError, dismiss, toasts],
  );

  return (
    <ToasterContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToasterContext.Provider>
  );
}

export function useToaster(): ToasterApi {
  const ctx = useContext(ToasterContext);
  if (!ctx) throw new Error('useToaster must be used inside ToasterProvider');
  return ctx;
}

function prettyTitleFor(err: ApiError): string {
  switch (err.code) {
    case 'rate_limited':
      return err.retryAfter
        ? `Too many requests — try again in ${err.retryAfter}s`
        : 'Too many requests';
    case 'unauthorized':
    case 'invalid_credentials':
      return 'Sign-in required';
    case 'forbidden':
      return "You don't have access to this action";
    case 'not_found':
      return 'Not found';
    case 'network_error':
      return 'Network error — check your connection';
    case 'internal_error':
      return 'Server error — our team has been notified';
    default:
      return err.message || 'Request failed';
  }
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}): React.ReactElement {
  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.tone === 'error' ? 'alert' : 'status'}
          className={[
            'min-w-[260px] max-w-sm rounded-lg border px-4 py-3 shadow-lg backdrop-blur',
            t.tone === 'error' && 'border-rose-200 bg-rose-50/95 text-rose-900',
            t.tone === 'warn' && 'border-amber-200 bg-amber-50/95 text-amber-900',
            t.tone === 'success' && 'border-emerald-200 bg-emerald-50/95 text-emerald-900',
            t.tone === 'info' && 'border-slate-200 bg-white/95 text-slate-900',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">{t.title}</div>
              {t.body ? <div className="mt-1 text-xs opacity-80">{t.body}</div> : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => onDismiss(t.id)}
              className="-mr-1 rounded p-1 text-xs opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
