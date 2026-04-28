import type {
  AnalyticsPoint,
  BottleneckRow,
  DetectedWorkflow,
  Integration,
  IntegrationProvider,
  IntegrationStatus,
  Invitation,
  InvitationPreview,
  Sop,
  SopStatus,
  SopStep,
  SopVersion,
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
import { getPublicApiBase } from '@/lib/apiBase';

/** Same resolution as `AuthContext` — empty = Vite proxy to Rails in dev (no CORS). */
const BASE = getPublicApiBase();
// Vitest has no backend; optional offline demos via VITE_USE_MOCK_API=true.
// Do NOT treat empty BASE as mock in development — that breaks proxy-based dev.
const USE_MOCK =
  import.meta.env.MODE === 'test' || import.meta.env.VITE_USE_MOCK_API === 'true';

export interface AnalyticsOverview {
  sopsTotal: number;
  runsLast30d: number;
  automationMinutesSaved: number;
  activeUsers: number;
  runsByDay: AnalyticsPoint[];
  bottlenecks: BottleneckRow[];
  runsLast7d: number;
  runsPrev7d: number;
  runsWeekOverWeekPercent: number | null;
  publishedSopsUpdatedLast7d: number;
  estimatedHoursSaved: number;
}

export interface WorkspacePayload {
  id: string;
  name: string;
  slug: string;
  settings: WorkspaceSettings;
}

/** Call audio upload → Whisper transcription → ai-engine SOP draft */
export interface CallRecordingRow {
  id: string;
  status: string;
  titleHint: string | null;
  transcript: string | null;
  /** True when the viewer cannot read transcript (e.g. viewer role, another user's upload). */
  transcriptRedacted?: boolean;
  errorMessage: string | null;
  sopId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** Admin workspace / billing / verification snapshot (GET /api/v1/organization). */
export interface OrganizationSnapshot {
  id: string;
  name: string;
  slug: string;
  claimedDomain: string | null;
  domainVerified: boolean;
  domainVerifiedAt: string | null;
  billingPlan: string;
  trialEndsAt: string | null;
  trialActive: boolean;
  seatsLimit: number;
  seatsUsed: number;
  dnsTxtHost: string | null;
  dnsTxtValue: string | null;
}

export interface WorkspaceSettings {
  auto_generate_sop: boolean;
  event_retention_days: number;
  capture_web_enabled: boolean;
  capture_desktop_enabled: boolean;
  capture_terminal_enabled: boolean;
  capture_pause_incognito: boolean;
  masking_rules?: Array<{ id: string; enabled: boolean }>;
}

/** Mock/offline defaults — aligned with backend `Workspace::SETTINGS_DEFAULTS` / masking ids. */
const MOCK_DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  auto_generate_sop: false,
  event_retention_days: 30,
  capture_web_enabled: true,
  capture_desktop_enabled: true,
  capture_terminal_enabled: false,
  capture_pause_incognito: true,
  masking_rules: [
    { id: 'email', enabled: true },
    { id: 'phone', enabled: true },
    { id: 'cc', enabled: true },
    { id: 'gov', enabled: true },
    { id: 'token', enabled: true },
    { id: 'password', enabled: true },
  ],
};

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

/** Multipart POST (e.g. call audio). Do not set Content-Type — browser sets boundary. */
async function fetchFormPost<T>(path: string, form: FormData): Promise<T> {
  const token = readToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method: 'POST', body: form, headers });
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
  return (await res.json()) as T;
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

  async signup(payload: {
    workspaceName: string;
    slug?: string;
    claimedDomain: string;
    adminEmail: string;
    adminPassword: string;
    adminName: string;
    billingPlan?: string;
    seatsLimit?: number;
  }): Promise<{ token: string; user: AuthUser; workspace: OrganizationSnapshot }> {
    if (USE_MOCK) {
      return {
        token: 'mock-signup',
        user: {
          id: 'u_new',
          email: payload.adminEmail,
          name: payload.adminName,
          role: 'admin',
          workspaceId: 'ws_mock',
          captureConsentAccepted: false,
        },
        workspace: {
          id: 'ws_mock',
          name: payload.workspaceName,
          slug: payload.slug ?? 'demo',
          claimedDomain: payload.claimedDomain,
          domainVerified: false,
          domainVerifiedAt: null,
          billingPlan: 'free_trial',
          trialEndsAt: new Date(Date.now() + 14 * 864e5).toISOString(),
          trialActive: true,
          seatsLimit: 50,
          seatsUsed: 1,
          dnsTxtHost: `_vopro.${payload.claimedDomain}`,
          dnsTxtValue: null,
        },
      };
    }
    return fetchJson('/api/v1/signup', {
      method: 'POST',
      body: JSON.stringify({
        signup: {
          workspace_name: payload.workspaceName,
          slug: payload.slug,
          claimed_domain: payload.claimedDomain,
          admin_email: payload.adminEmail,
          admin_password: payload.adminPassword,
          admin_name: payload.adminName,
          billing_plan: payload.billingPlan,
          seats_limit: payload.seatsLimit,
        },
      }),
    });
  },

  async verifySignupEmail(token: string): Promise<{ ok: boolean; workspaceId: string }> {
    if (USE_MOCK) return { ok: true, workspaceId: 'ws_mock' };
    return fetchJson('/api/v1/signup/verify_email', {
      method: 'POST',
      body: JSON.stringify({ token }),
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
          captureConsentAccepted: false,
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

  async recordCaptureConsent(): Promise<void> {
    if (USE_MOCK) return;
    await fetchJson<void>('/api/v1/me/consents', {
      method: 'POST',
      body: JSON.stringify({ consent_key: 'workflow_capture_policy_v1' }),
    });
  },

  async getOrganization(): Promise<OrganizationSnapshot> {
    if (USE_MOCK) {
      return {
        id: 'ws_mock',
        name: 'Demo Workspace',
        slug: 'demo',
        claimedDomain: 'vopro.local',
        domainVerified: true,
        domainVerifiedAt: new Date().toISOString(),
        billingPlan: 'professional',
        trialEndsAt: null,
        trialActive: false,
        seatsLimit: 50,
        seatsUsed: 8,
        dnsTxtHost: '_vopro.vopro.local',
        dnsTxtValue: null,
      };
    }
    return fetchJson<OrganizationSnapshot>('/api/v1/organization');
  },

  async startDnsVerification(): Promise<{ dnsTxtHost: string; dnsTxtValue: string }> {
    if (USE_MOCK) {
      return { dnsTxtHost: '_vopro.example.com', dnsTxtValue: 'vopro-verify=mock' };
    }
    return fetchJson<{ dnsTxtHost: string; dnsTxtValue: string }>(
      '/api/v1/organization/domain_dns/start',
      { method: 'POST' },
    );
  },

  async verifyDns(): Promise<OrganizationSnapshot> {
    if (USE_MOCK) {
      return {
        id: 'ws_mock',
        name: 'Demo Workspace',
        slug: 'demo',
        claimedDomain: 'vopro.local',
        domainVerified: true,
        domainVerifiedAt: new Date().toISOString(),
        billingPlan: 'professional',
        trialEndsAt: null,
        trialActive: false,
        seatsLimit: 50,
        seatsUsed: 8,
        dnsTxtHost: '_vopro.vopro.local',
        dnsTxtValue: null,
      };
    }
    return fetchJson<OrganizationSnapshot>('/api/v1/organization/domain_dns/verify', {
      method: 'POST',
    });
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

  async createSop(payload: {
    title: string;
    description?: string;
    status?: SopStatus;
    tags?: string[];
    steps?: SopStep[];
  }): Promise<Sop> {
    if (USE_MOCK) {
      const id = `sop_local_${Date.now()}`;
      const sop: Sop = {
        id,
        title: payload.title,
        description: payload.description ?? '',
        status: payload.status ?? 'draft',
        ownerName: 'You',
        ownerInitials: 'YO',
        tags: payload.tags ?? [],
        steps: payload.steps ?? [],
        versions: [],
        lastUpdated: new Date().toISOString(),
        contributors: 1,
        runsObserved: 0,
        averageDurationSec: 0,
        confidence: 0,
      };
      MOCK_SOPS.unshift(sop);
      return sop;
    }
    return fetchJson<Sop>('/api/v1/sops', {
      method: 'POST',
      body: JSON.stringify({ sop: payload }),
    });
  },

  async deleteSop(id: string): Promise<void> {
    if (USE_MOCK) {
      const idx = MOCK_SOPS.findIndex((s) => s.id === id);
      if (idx >= 0) MOCK_SOPS.splice(idx, 1);
      return;
    }
    await fetchJson<void>(`/api/v1/sops/${id}`, { method: 'DELETE' });
  },

  async listSopVersions(id: string): Promise<SopVersion[]> {
    if (USE_MOCK) {
      return MOCK_SOPS.find((s) => s.id === id)?.versions ?? [];
    }
    return fetchJson<SopVersion[]>(`/api/v1/sops/${id}/versions`);
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

  async getWorkflow(id: string): Promise<DetectedWorkflow> {
    if (USE_MOCK) {
      const w = MOCK_DETECTED.find((d) => d.id === id);
      if (!w) throw new ApiError({ status: 404, code: 'not_found', message: 'Workflow not found' });
      return w;
    }
    return fetchJson<DetectedWorkflow>(`/api/v1/workflows/${id}`);
  },

  async updateWorkflow(
    id: string,
    patch: { title?: string; status?: DetectedWorkflow['status'] },
  ): Promise<DetectedWorkflow> {
    if (USE_MOCK) {
      const idx = MOCK_DETECTED.findIndex((d) => d.id === id);
      if (idx < 0) throw new ApiError({ status: 404, code: 'not_found', message: 'Workflow not found' });
      MOCK_DETECTED[idx] = { ...MOCK_DETECTED[idx], ...patch };
      return MOCK_DETECTED[idx];
    }
    return fetchJson<DetectedWorkflow>(`/api/v1/workflows/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ workflow: patch }),
    });
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

  async updateIntegration(
    id: string,
    patch: {
      status?: IntegrationStatus;
      settings?: Record<string, unknown>;
      secrets?: Record<string, unknown>;
    },
  ): Promise<Integration> {
    if (USE_MOCK) {
      const idx = MOCK_INTEGRATIONS.findIndex((i) => i.id === id);
      if (idx < 0) throw new ApiError({ status: 404, code: 'not_found', message: 'Integration not found' });
      const prev = MOCK_INTEGRATIONS[idx];
      MOCK_INTEGRATIONS[idx] = {
        ...prev,
        ...patch,
        settings: patch.settings ? { ...prev.settings, ...patch.settings } : prev.settings,
      };
      return MOCK_INTEGRATIONS[idx];
    }
    return fetchJson<Integration>(`/api/v1/integrations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ integration: patch }),
    });
  },

  // ---- analytics -----------------------------------------------------------
  async analytics(): Promise<AnalyticsOverview> {
    if (USE_MOCK) {
      const runsLast30d = MOCK_ANALYTICS.reduce((s, p) => s + p.runs, 0);
      const runsLast7d = MOCK_ANALYTICS.reduce((s, p) => s + p.runs, 0);
      return {
        sopsTotal: MOCK_SOPS.length,
        runsLast30d,
        automationMinutesSaved: 1240,
        activeUsers: 18,
        runsByDay: MOCK_ANALYTICS,
        bottlenecks: MOCK_BOTTLENECKS,
        runsLast7d,
        runsPrev7d: Math.max(1, Math.round(runsLast7d * 0.85)),
        runsWeekOverWeekPercent: 12.4,
        publishedSopsUpdatedLast7d: 3,
        estimatedHoursSaved: Math.round((1240 / 60) * 10) / 10,
      };
    }
    return fetchJson<AnalyticsOverview>('/api/v1/analytics/overview');
  },
  async bottlenecks(): Promise<BottleneckRow[]> {
    if (USE_MOCK) return MOCK_BOTTLENECKS;
    return fetchJson<BottleneckRow[]>('/api/v1/analytics/bottlenecks');
  },

  async getWorkspace(): Promise<WorkspacePayload> {
    if (USE_MOCK) {
      return {
        id: 'ws_mock',
        name: 'Demo Workspace',
        slug: 'demo',
        settings: { ...MOCK_DEFAULT_WORKSPACE_SETTINGS },
      };
    }
    return fetchJson<WorkspacePayload>('/api/v1/workspace');
  },

  async updateWorkspace(patch: Partial<WorkspaceSettings>): Promise<WorkspacePayload> {
    if (USE_MOCK) {
      return {
        id: 'ws_mock',
        name: 'Demo Workspace',
        slug: 'demo',
        settings: { ...MOCK_DEFAULT_WORKSPACE_SETTINGS, ...patch },
      };
    }
    return fetchJson<WorkspacePayload>('/api/v1/workspace', {
      method: 'PATCH',
      body: JSON.stringify({ workspace: { settings: patch } }),
    });
  },

  async listCallRecordings(): Promise<CallRecordingRow[]> {
    if (USE_MOCK) return [];
    return fetchJson<CallRecordingRow[]>('/api/v1/call_recordings');
  },

  async uploadCallRecording(file: File, titleHint?: string): Promise<CallRecordingRow> {
    if (USE_MOCK) {
      return {
        id: 'mock_cr',
        status: 'completed',
        titleHint: titleHint ?? null,
        transcript: 'Demo transcript.',
        transcriptRedacted: false,
        errorMessage: null,
        sopId: null,
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    const fd = new FormData();
    fd.append('audio', file);
    if (titleHint?.trim()) fd.append('title_hint', titleHint.trim());
    return fetchFormPost<CallRecordingRow>('/api/v1/call_recordings', fd);
  },

  async createIntegration(payload: {
    provider: IntegrationProvider;
    status?: IntegrationStatus;
    settings?: Record<string, unknown>;
    secrets?: Record<string, unknown>;
  }): Promise<Integration> {
    if (USE_MOCK) {
      return {
        id: `int_${Date.now()}`,
        provider: payload.provider,
        status: payload.status ?? 'connected',
        settings: payload.settings ?? {},
        createdAt: new Date().toISOString(),
      };
    }
    return fetchJson<Integration>('/api/v1/integrations', {
      method: 'POST',
      body: JSON.stringify({ integration: payload }),
    });
  },
};

export { ApiError };
