/**
 * Browser-visible API origin prefix for `fetch`.
 *
 * - **''** (empty): same-origin URLs (`/api/v1/...`). In Vite dev, `vite.config.ts`
 *   proxies `/api` → Rails, so there is **no CORS** and login works even when
 *   `.env` still says `http://127.0.0.1:3000`.
 * - **`http(s)://host`**: cross-origin — backend must list your UI origin in
 *   `ALLOWED_ORIGINS`.
 *
 * In **development**, if `VITE_API_BASE_URL` targets **`localhost:3000`** or
 * **`127.0.0.1:3000`**, we return **`''`** unless **`VITE_FORCE_CROSS_ORIGIN_API=true`**
 * (for debugging real CORS locally).
 */
export function getPublicApiBase(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL ?? '').trim();

  if (import.meta.env.MODE === 'test') {
    return raw;
  }

  if (import.meta.env.DEV && raw && import.meta.env.VITE_FORCE_CROSS_ORIGIN_API !== 'true') {
    try {
      const u = new URL(raw);
      const localRails =
        (u.hostname === 'localhost' || u.hostname === '127.0.0.1') &&
        u.port === '3000' &&
        (u.protocol === 'http:' || u.protocol === 'https:');
      if (localRails) {
        return '';
      }
    } catch {
      /* malformed VITE_API_BASE_URL — fall through */
    }
  }

  return raw;
}
