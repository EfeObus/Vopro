import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleDot, Pause, Play } from 'lucide-react';
import { api, type WorkspaceSettings } from '@/lib/api';
import { useAuth } from '@/auth/AuthContext';

function channelsLabel(s: WorkspaceSettings): string {
  const parts: string[] = [];
  if (s.capture_web_enabled) parts.push('Web');
  if (s.capture_desktop_enabled) parts.push('Desktop');
  if (s.capture_terminal_enabled) parts.push('Terminal');
  return parts.length > 0 ? parts.join(' · ') : 'None enabled';
}

export default function CaptureStatusCard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Policy before pausing — used so admins can resume from the shell without guessing toggles. */
  const [pausedSnapshot, setPausedSnapshot] = useState<WorkspaceSettings | null>(null);

  const load = useCallback(() => {
    setError(null);
    api
      .getWorkspace()
      .then((w) => setSettings(w.settings))
      .catch(() => setError('Could not load workspace.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const anyCaptureEnabled =
    settings &&
    (settings.capture_web_enabled ||
      settings.capture_desktop_enabled ||
      settings.capture_terminal_enabled);

  // If capture was re-enabled elsewhere (e.g. Settings), drop stale resume state.
  useEffect(() => {
    if (pausedSnapshot && settings && anyCaptureEnabled) {
      setPausedSnapshot(null);
    }
  }, [pausedSnapshot, settings, anyCaptureEnabled]);

  async function pauseAll() {
    if (!settings || !isAdmin) return;
    setPausedSnapshot({ ...settings });
    setBusy(true);
    setError(null);
    try {
      const next = await api.updateWorkspace({
        capture_web_enabled: false,
        capture_desktop_enabled: false,
        capture_terminal_enabled: false,
      });
      setSettings(next.settings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update.');
    } finally {
      setBusy(false);
    }
  }

  async function resumeFromSnapshot() {
    const snap = pausedSnapshot;
    if (!snap || !isAdmin) return;
    setBusy(true);
    setError(null);
    try {
      const next = await api.updateWorkspace({
        capture_web_enabled: snap.capture_web_enabled,
        capture_desktop_enabled: snap.capture_desktop_enabled,
        capture_terminal_enabled: snap.capture_terminal_enabled,
      });
      setSettings(next.settings);
      setPausedSnapshot(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="m-3 mt-0 p-3 rounded-lg border border-ink-100 bg-ink-50">
        <div className="text-xs text-ink-400">Loading capture status…</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="m-3 mt-0 p-3 rounded-lg border border-ink-100 bg-ink-50">
        <div className="text-xs text-ink-500">{error ?? 'Workspace unavailable.'}</div>
      </div>
    );
  }

  const paused = !anyCaptureEnabled;
  const canResume = paused && pausedSnapshot !== null && isAdmin;

  return (
    <div className="m-3 mt-0 p-3 rounded-lg border border-ink-100 bg-ink-50">
      <div className="flex items-center gap-2 mb-1">
        <CircleDot
          className={`size-3.5 ${paused ? 'text-ink-300' : 'text-emerald-500 animate-pulse'}`}
        />
        <span className="text-xs font-semibold text-ink-700">
          {paused ? 'Capture paused (workspace)' : 'Capture enabled (workspace)'}
        </span>
      </div>
      <div className="text-xs text-ink-500 leading-snug">
        Policy: {channelsLabel(settings)}
        <span className="block mt-0.5 text-ink-400">
          The desktop agent uses these workspace defaults. Install and opt in per app from the agent.
        </span>
      </div>
      {error && (
        <div role="alert" className="mt-2 text-[11px] text-red-700">
          {error}
        </div>
      )}
      <div className="mt-2 flex flex-col gap-1.5">
        {isAdmin ? (
          <>
            {!paused ? (
              <button
                type="button"
                disabled={busy}
                className="btn-outline w-full justify-center text-xs py-1.5"
                onClick={() => void pauseAll()}
              >
                <Pause className="size-3.5" />
                {busy ? 'Updating…' : 'Pause all capture'}
              </button>
            ) : canResume ? (
              <button
                type="button"
                disabled={busy}
                className="btn-outline w-full justify-center text-xs py-1.5"
                onClick={() => void resumeFromSnapshot()}
              >
                <Play className="size-3.5" />
                {busy ? 'Updating…' : 'Resume capture'}
              </button>
            ) : (
              <Link to="/settings" className="btn-outline w-full justify-center text-xs py-1.5">
                Configure in Settings
              </Link>
            )}
          </>
        ) : (
          <Link to="/settings" className="btn-outline w-full justify-center text-xs py-1.5">
            View capture settings
          </Link>
        )}
      </div>
    </div>
  );
}
