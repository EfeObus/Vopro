import React from 'react';
import { ApiError } from '@/lib/api';

interface State {
  error: Error | null;
  resetKey: number;
}

interface Props {
  children: React.ReactNode;
  /** Optional override for the fallback UI. Defaults to `<DefaultFallback>`. */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  /** Called once on first error. Useful for forwarding to Sentry. */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

/**
 * App-wide error boundary. Catches render-time exceptions and shows a
 * friendly fallback that lets the user try again without a full reload.
 *
 * For uncaught async errors (rejected fetches, etc.) we install a
 * `window.onunhandledrejection` listener that promotes the rejection into
 * a render error so this boundary catches it too.
 */
export class RootErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    this.props.onError?.(error, info);
    if (typeof window !== 'undefined' && import.meta.env.MODE !== 'test') {
      console.error('[RootErrorBoundary]', error, info.componentStack);
    }
  }

  reset = (): void => {
    this.setState((s) => ({ error: null, resetKey: s.resetKey + 1 }));
  };

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) {
      return <div key={this.state.resetKey}>{this.props.children}</div>;
    }
    if (this.props.fallback) {
      return <>{this.props.fallback(error, this.reset)}</>;
    }
    return <DefaultFallback error={error} onReset={this.reset} />;
  }
}

function DefaultFallback({
  error,
  onReset,
}: {
  error: Error;
  onReset: () => void;
}): React.ReactElement {
  const isApi = error instanceof ApiError;
  const requestId = isApi ? error.requestId : undefined;
  const code = isApi ? error.code : 'render_error';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div
        role="alert"
        className="max-w-lg w-full rounded-2xl border border-rose-200 bg-white p-8 shadow-lg"
      >
        <h1 className="text-xl font-semibold text-rose-700">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600">
          {error.message || 'An unexpected error occurred.'}
        </p>

        <dl className="mt-4 space-y-1 text-xs text-slate-500">
          <div>
            <dt className="inline font-medium">Error code: </dt>
            <dd className="inline font-mono">{code}</dd>
          </div>
          {requestId ? (
            <div>
              <dt className="inline font-medium">Request id: </dt>
              <dd className="inline font-mono">{requestId}</dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onReset}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Reload the page
          </button>
          <a
            href="mailto:support@vopro.com?subject=Vopro%20error%20report"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Promotes async rejections (uncaught Promise errors, e.g. an unhandled
 * `await api.foo()`) into render errors so the boundary can render a
 * fallback. Without this, async rejections silently disappear into the
 * console.
 */
export function installGlobalRejectionHandler(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason instanceof Error) {
      // Re-throw on the next tick so React's error boundary catches it.
      setTimeout(() => {
        throw reason;
      }, 0);
    }
  });
}
