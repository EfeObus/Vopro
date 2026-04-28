import type {
  AnalyticsPoint,
  BottleneckRow,
  DetectedWorkflow,
  Integration,
  IntegrationProvider,
  Invitation,
  InvitationPreview,
  Sop,
  UserRole,
} from '@/types';
import {
  MOCK_ANALYTICS,
  MOCK_BOTTLENECKS,
  MOCK_DETECTED,
  MOCK_INTEGRATIONS,
  MOCK_SOPS,
} from '@/data/mock';
import { clearAuth, readToken, type AuthUser } from '@/auth/AuthContext';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';
// Only fall back to mocks in tests (no API base configured) or when explicitly opted in.
const USE_MOCK = import.meta.env.MODE === 'test' || !BASE;

export interface AnalyticsOverview {
  sopsTotal: number;
  runsLast30d: number;
  automationMinutesSaved: number;
  activeUsers: number;
  runsByDay: AnalyticsPoint[];
  bottlenecks: BottleneckRow[];
}

/**
 * Strongly-typed error thrown by `fetchJson` / `fetchBlob`.
 *
 * Mirrors the backend's unified envelope:
 *   { error: { code, message, status, request_id, details? } }
 *
 * Components should branch on `.code` (stable) — never on `.message`.
 * `requestId` is shown in support copy / pasted into Sentry tickets.
 */
class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details?: unknown;
  readonly retryAfter?: number;

  constructor(opts: {
    status: number;
    message: string;
    code?: string;
    requestId?: string;
    details?: unknown;
    retryAfter?: number;
  }) {
    super(opts.message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.code = opts.code ?? `http_${opts.status}`;
    this.requestId = opts.requestId;
    this.details = opts.details;
    this.retryAfter = opts.retryAfter;
  }

  /** Convenience for components: `if (err.is(404, 'not_found'))`. */
  is(status: number, code?: string): boolean {
    if (this.status !== status) return false;
    return code ? this.code === code : true;
  }
}

interface BackendErrorBody {
  error?: {
    code?: string;
    message?: string;
    status?: number;
    request_id?: string;
    details?: unknown;
  };
  retry_after?: number;
}

async function buildApiError(res: Response): Promise<ApiError> {
  const retryAfterHeader = res.headers.get('Retry-After');
  let parsed: BackendErrorBody | null = null;
  try {
    parsed = (await res.clone().json()) as BackendErrorBody;
  } catch {
    parsed = null;
  }

  const env = parsed?.error;
  if (env) {
    return new ApiError({
      status: res.status,
      message: env.message || `Request failed: ${res.status}`,
      code: env.code,
      requestId: env.request_id,
      details: env.details,
      retryAfter: parsed?.retry_after ?? (Number(retryAfterHeader) || undefined),
    });
  }

  // Plain-text or unknown body — keep the raw body as the message.
  const text = await res.text().catch(() => '');
  return new ApiError({
    status: res.status,
    message: text || `Request failed: ${res.status}`,
    retryAfter: Number(retryAfterHeader) || undefined,
  });
}

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string> | undefined) ?? {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch (cause) {
    // Network failure (DNS, offline, CORS preflight refused, etc.)
    throw new ApiError({
      status: 0,
      code: 'network_error',
      message: cause instanceof Error ? cause.message : 'Network request failed',
    });
  }

  if (res.status === 401) {
    clearAuth();
    throw await buildApiError(res);
  }
  if (res.status === 204) {
    return undefined as unknown as T;
  }
  if (!res.ok) {
    throw await buildApiError(res);
  }
  return (await res.json()) as T;
}

async function fetchBlob(path: string): Promise<Blob> {
  const token = readToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { headers });
  } catch (cause) {
    throw new ApiError({
      status: 0,
      code: 'network_error',
      message: cause instanceof Error ? cause.message : 'Network request failed',
    });
  }
  if (res.status === 401) {
    clearAuth();
    throw await buildApiError(res);
  }
  if (!res.ok) {
    throw await buildApiError(res);
  }
  return res.blob();
}

export const api = {
  // ---- auth ----------------------------------------------------------------
  async me(): Promise<AuthUser | null> {
    if (USE_MOCK) return null;
    try {
      return await fetchJson<AuthUser>('/api/v1/auth/me');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return null;
      throw err;
    }
  },
  async forgotPassword(email: string): Promise<{ status: 'sent' }> {
    if (USE_MOCK) return { status: 'sent' };
    return fetchJson('/api/v1/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
  async resetPassword(token: string, password: string): Promise<void> {
    if (USE_MOCK) return;
    await fetchJson<void>('/api/v1/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },
  async refreshToken(): Promise<{ token: string }> {
    if (USE_MOCK) return { token: '' };
    return fetchJson('/api/v1/auth/refresh', { method: 'POST' });
  },
  async previewInvitation(token: string): Promise<InvitationPreview> {
    if (USE_MOCK) {
      return { email: 'preview@vopro.local', role: 'viewer', workspaceName: 'Vopro' };
    }
    return fetchJson<InvitationPreview>(`/api/v1/auth/invitations/${token}`);
  },
  async acceptInvitation(
    token: string,
    payload: { name: string; password: string },
  ): Promise<{ token: string; user: AuthUser }> {
    if (USE_MOCK) {
      return {
        token: 'mock',
        user: {
          id: 'u_invited',
          name: payload.name,
          email: 'invited@example.com',
          role: 'viewer',
          workspaceId: 'ws_mock',
        },
      };
    }
    return fetchJson(`/api/v1/auth/invitations/${token}/accept`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
  async listInvitations(): Promise<Invitation[]> {
    if (USE_MOCK) return [];
    return fetchJson<Invitation[]>('/api/v1/invitations');
  },
  async createInvitation(email: string, role: UserRole = 'viewer'): Promise<Invitation> {
    if (USE_MOCK) {
      return {
        id: `inv_${Date.now()}`,
        email,
        role,
        inviterId: 'u_self',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        acceptedAt: null,
        revokedAt: null,
        createdAt: new Date().toISOString(),
        token: 'mock-token',
      };
    }
    return fetchJson('/api/v1/invitations', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  },
  async revokeInvitation(id: string): Promise<void> {
    if (USE_MOCK) return;
    await fetchJson<void>(`/api/v1/invitations/${id}`, { method: 'DELETE' });
  },
  async exportMyData(): Promise<Blob> {
    if (USE_MOCK) return new Blob(['{}'], { type: 'application/json' });
    return fetchBlob('/api/v1/me/export');
  },
  async deleteMyAccount(): Promise<void> {
    if (USE_MOCK) return;
    await fetchJson<void>('/api/v1/me', { method: 'DELETE' });
  },

  // ---- sops ----------------------------------------------------------------
  async listSops(): Promise<Sop[]> {
    if (USE_MOCK) return MOCK_SOPS;
    return fetchJson<Sop[]>('/api/v1/sops');
  },
  async getSop(id: string): Promise<Sop | undefined> {
    if (USE_MOCK) return MOCK_SOPS.find((s) => s.id === id);
    return fetchJson<Sop>(`/api/v1/sops/${id}`);
  },
  async updateSop(id: string, patch: Partial<Sop>, summary?: string): Promise<Sop> {
    if (USE_MOCK) {
      const next = { ...(MOCK_SOPS.find((s) => s.id === id) as Sop), ...patch };
      return next;
    }
    return fetchJson<Sop>(`/api/v1/sops/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ sop: patch, summary }),
    });
  },
  async publishSop(id: string): Promise<{ status: Sop['status'] }> {
    if (USE_MOCK) return { status: 'published' };
    return fetchJson(`/api/v1/sops/${id}/publish`, { method: 'POST' });
  },
  async archiveSop(id: string): Promise<{ status: Sop['status'] }> {
    if (USE_MOCK) return { status: 'archived' };
    return fetchJson(`/api/v1/sops/${id}/archive`, { method: 'POST' });
  },
  async exportSop(id: string, format: 'markdown' | 'json' | 'pdf' = 'markdown'): Promise<Blob> {
    if (USE_MOCK) {
      const sop = MOCK_SOPS.find((s) => s.id === id);
      const body = sop ? `# ${sop.title}\n\n${sop.description}` : '';
      return new Blob([body], { type: 'text/plain' });
    }
    return fetchBlob(`/api/v1/sops/${id}/export?format=${format}`);
  },

  // ---- workflows -----------------------------------------------------------
  async listDetected(): Promise<DetectedWorkflow[]> {
    if (USE_MOCK) return MOCK_DETECTED;
    return fetchJson<DetectedWorkflow[]>('/api/v1/workflows?status=pending');
  },
  async dismissWorkflow(id: string): Promise<DetectedWorkflow> {
    if (USE_MOCK) {
      const w = MOCK_DETECTED.find((d) => d.id === id);
      if (!w) throw new ApiError({ status: 404, code: 'not_found', message: 'Not found' });
      return { ...w, status: 'dismissed' };
    }
    return fetchJson<DetectedWorkflow>(`/api/v1/workflows/${id}/dismiss`, { method: 'POST' });
  },
  async generateSopFromWorkflow(id: string): Promise<{ status: string }> {
    if (USE_MOCK) return { status: 'queued' };
    return fetchJson(`/api/v1/workflows/${id}/generate_sop`, { method: 'POST' });
  },

  // ---- integrations --------------------------------------------------------
  async listIntegrations(): Promise<Integration[]> {
    if (USE_MOCK) return MOCK_INTEGRATIONS;
    return fetchJson<Integration[]>('/api/v1/integrations');
  },
  async startOAuth(provider: IntegrationProvider): Promise<{ url: string }> {
    if (USE_MOCK) return { url: `https://example.com/oauth/${provider}` };
    return fetchJson<{ url: string }>(`/api/v1/integrations/${provider}/start`);
  },
  async disconnectIntegration(id: string): Promise<void> {
    if (USE_MOCK) return;
    await fetchJson<void>(`/api/v1/integrations/${id}`, { method: 'DELETE' });
  },

  // ---- analytics -----------------------------------------------------------
  async analytics(): Promise<AnalyticsOverview> {
    if (USE_MOCK) {
      return {
        sopsTotal: MOCK_SOPS.length,
        runsLast30d: MOCK_ANALYTICS.reduce((s, p) => s + p.runs, 0),
        automationMinutesSaved: 1240,
        activeUsers: 18,
        runsByDay: MOCK_ANALYTICS,
        bottlenecks: MOCK_BOTTLENECKS,
      };
    }
    return fetchJson<AnalyticsOverview>('/api/v1/analytics/overview');
  },
  async bottlenecks(): Promise<BottleneckRow[]> {
    if (USE_MOCK) return MOCK_BOTTLENECKS;
    return fetchJson<BottleneckRow[]>('/api/v1/analytics/bottlenecks');
  },
};

export { ApiError };
