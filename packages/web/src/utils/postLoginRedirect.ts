// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Return-path for deep links that need a session (e.g. an accountant
// opening /accept-firm-invite/:token from an email while logged out).
// ProtectedRoute stashes the intended path before bouncing to /login;
// the login / magic-link pages consume it after tokens are stored.
//
// sessionStorage rather than router state so the value survives the
// magic-link and passkey round trips (which leave and re-enter the SPA).
// Only same-origin absolute paths are honoured — never a full URL, and
// never a protocol-relative `//host` — so this can't become an open
// redirect.

const KEY = 'vmb.postLoginRedirect';

export function rememberPostLoginRedirect(path: string): void {
  if (!path || path === '/' || !/^\/(?!\/)/.test(path)) return;
  try { sessionStorage.setItem(KEY, path); } catch { /* storage disabled */ }
}

export function consumePostLoginRedirect(): string {
  try {
    const v = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (v && /^\/(?!\/)/.test(v)) return v;
  } catch { /* storage disabled */ }
  return '/';
}
