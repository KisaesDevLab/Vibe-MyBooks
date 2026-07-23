// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// `import.meta.env.BASE_URL` is the subpath the SPA is mounted under
// (Vite injects this from the `base` option in vite.config.ts). It
// always has a trailing slash — '/' at root, '/mb/' under a subpath —
// so concatenation produces '/api/v1' or '/mb/api/v1' without a double
// slash. When the appliance's front nginx strips the `/mb/` prefix, the
// backend still receives `/api/v1/…` and routing is unaffected.
//
// Exported so callers that issue raw `fetch()` calls (multipart uploads,
// SSE/streaming endpoints, anything outside the JSON happy path that
// apiClient covers) can build their URLs against the same base. Without
// this, hooks using bare `fetch('/api/v1/...')` ship absolute paths and
// 404 in multi-app appliance installs (BASE_URL=`/mybooks/`).
export const API_BASE = `${import.meta.env.BASE_URL}api/v1`;

// The app's mount prefix without a trailing slash ('/mybooks' under a subpath,
// '' at root). Sent as `X-App-Base` on requests so the API can scope the refresh
// cookie's Path correctly even when the appliance strips the prefix before the
// request reaches it — no operator COOKIE_PATH config required.
export const APP_BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

// What the web actually handles. The refresh token lives in an HttpOnly
// cookie now, so this side of the wire only ever sees the access token.
export interface AuthTokens {
  accessToken: string;
}

// The refresh token used to live in localStorage, which made it reachable by
// any script on the page (i.e. any XSS). It now lives in an HttpOnly cookie
// the server sets on every token-issuing response; the browser ships it
// automatically on /api/v1/auth/refresh and no JS ever sees it. We still
// keep the short-lived access token in localStorage so reloads can reuse it
// without a refresh round-trip, but the long-lived credential is gone.

let accessToken: string | null = localStorage.getItem('accessToken');
let isRefreshing = false;
let refreshPromise: Promise<AuthTokens | null> | null = null;

// Providers that depend on a logged-in session (CompanyProvider most
// critically) need to know when a token appears or disappears so they can
// refetch. useEffect-on-mount isn't enough: a provider that mounted on the
// login page sees no token on first run and would otherwise never retry.
// We emit a window CustomEvent on every transition so any listener can
// react without CompanyProvider having to know about them.
export const TOKEN_CHANGE_EVENT = 'kisbooks:auth-token-changed';

function emitTokenChange() {
  window.dispatchEvent(new CustomEvent(TOKEN_CHANGE_EVENT));
}

export function setTokens(tokens: AuthTokens) {
  accessToken = tokens.accessToken;
  localStorage.setItem('accessToken', tokens.accessToken);
  // Proactively scrub any refresh token left over from a previous version of
  // the client so it can't linger in localStorage after an upgrade.
  localStorage.removeItem('refreshToken');
  emitTokenChange();
}

export function clearTokens() {
  accessToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  emitTokenChange();
}

export function getAccessToken(): string | null {
  return accessToken;
}

// ─── Super-admin impersonation ("View as") ───────────────────────
// Swap the current admin access token for a short-lived impersonation token
// (target user's context, NOT super-admin) so the app renders exactly what
// that user can see/do. The admin token is stashed so it can be restored.
const IMPERSONATION_KEY = 'impersonation';

interface ImpersonationState { originalToken: string; targetName: string; targetId: string }

export function startImpersonation(impersonationToken: string, target: { id: string; name: string }): void {
  if (!accessToken) return;
  const state: ImpersonationState = { originalToken: accessToken, targetName: target.name, targetId: target.id };
  localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(state));
  accessToken = impersonationToken;
  localStorage.setItem('accessToken', impersonationToken);
  emitTokenChange();
}

/** Restore the admin token and end impersonation. Safe to call when not impersonating. */
export function stopImpersonation(): void {
  const raw = localStorage.getItem(IMPERSONATION_KEY);
  localStorage.removeItem(IMPERSONATION_KEY);
  if (!raw) return;
  try {
    const state = JSON.parse(raw) as ImpersonationState;
    if (state.originalToken) {
      accessToken = state.originalToken;
      localStorage.setItem('accessToken', state.originalToken);
      emitTokenChange();
    }
  } catch {
    /* corrupted state — the caller reloads; a fresh refresh recovers the admin session */
  }
}

export function getImpersonation(): { targetName: string; targetId: string } | null {
  try {
    const raw = localStorage.getItem(IMPERSONATION_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as ImpersonationState;
    return { targetName: state.targetName, targetId: state.targetId };
  } catch {
    return null;
  }
}

export async function refreshAccessToken(): Promise<AuthTokens | null> {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Base': APP_BASE },
    credentials: 'include',
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    clearTokens();
    return null;
  }

  const data = await res.json();
  const tokens: AuthTokens = data.tokens;
  setTokens(tokens);
  return tokens;
}

export async function apiClient<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-App-Base': APP_BASE,
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  // Include active company context
  const activeCompanyId = localStorage.getItem('activeCompanyId');
  if (activeCompanyId) {
    headers['X-Company-Id'] = activeCompanyId;
  }

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });

  if (res.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshAccessToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    const tokens = await refreshPromise;
    if (!tokens) {
      window.location.href = `${import.meta.env.BASE_URL}login`;
      throw new Error('Session expired');
    }
    headers['Authorization'] = `Bearer ${accessToken}`;
    res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: 'Request failed' } }));
    throw new ApiError(
      body?.error?.message || 'Request failed',
      body?.error?.code,
      body?.error?.details,
      res.status,
    );
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

/**
 * Error thrown by `apiClient` when the server responds non-2xx. Carries
 * the structured `{ message, code, details? }` payload from the server's
 * error envelope (see packages/api/src/middleware/error-handler.ts) so
 * React Query `onError` handlers can render toast messages keyed on
 * `code` instead of brittle string matching on `message`.
 *
 * `isApiError(err)` is the runtime narrow most callers want — checking
 * `err instanceof ApiError` works inside this bundle but breaks across
 * HMR boundaries when Vite reloads this module and the previously-thrown
 * error's prototype no longer matches.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: unknown,
    public status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(err: unknown): err is ApiError {
  return !!err && typeof err === 'object' && (err as { name?: unknown }).name === 'ApiError';
}
