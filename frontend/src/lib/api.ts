import type { AnalyticsPoint, BottleneckRow, DetectedWorkflow, Sop } from '@/types';
import { MOCK_ANALYTICS, MOCK_BOTTLENECKS, MOCK_DETECTED, MOCK_SOPS } from '@/data/mock';

const BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const USE_MOCK = !BASE || import.meta.env.MODE === 'test';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  async listSops(): Promise<Sop[]> {
    if (USE_MOCK) return Promise.resolve(MOCK_SOPS);
    return fetchJson<Sop[]>('/api/v1/sops');
  },
  async getSop(id: string): Promise<Sop | undefined> {
    if (USE_MOCK) return Promise.resolve(MOCK_SOPS.find((s) => s.id === id));
    return fetchJson<Sop>(`/api/v1/sops/${id}`);
  },
  async listDetected(): Promise<DetectedWorkflow[]> {
    if (USE_MOCK) return Promise.resolve(MOCK_DETECTED);
    return fetchJson<DetectedWorkflow[]>('/api/v1/workflows?status=pending');
  },
  async analytics(): Promise<{ runsByDay: AnalyticsPoint[]; bottlenecks: BottleneckRow[] }> {
    if (USE_MOCK) return Promise.resolve({ runsByDay: MOCK_ANALYTICS, bottlenecks: MOCK_BOTTLENECKS });
    return fetchJson('/api/v1/analytics/overview');
  },
};
