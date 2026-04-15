const API_BASE = '/api/v1';

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

async function refreshAccessToken(): Promise<AuthTokens | null> {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
      window.location.href = '/login';
      throw new Error('Session expired');
    }
    headers['Authorization'] = `Bearer ${accessToken}`;
    res = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: 'Request failed' } }));
    throw new Error(error.error?.message || 'Request failed');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
