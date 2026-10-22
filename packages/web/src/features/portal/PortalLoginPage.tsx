// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 9.2 — sign in with an email
// address or a mobile number. The request endpoint always returns ok
// regardless of whether anything matched, so this page never reveals
// account existence. The message (an email for an address, a text for a
// number) carries a 6-digit code for step 2 and a tap-to-sign-in link.
// Someone on several clients gets one message per client; the code they
// type picks the client.

type Kind = 'email' | 'phone';

/** What the person typed, as the server will read it (null = not valid yet). */
export function identifierKind(raw: string): Kind | null {
  const v = raw.trim();
  if (!v) return null;
  if (v.includes('@')) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'email' : null;
  if (!/^\+?[\d\s().-]+$/.test(v)) return null;
  const digits = v.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 ? 'phone' : null;
}

async function messageOf(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    const msg = body?.error?.message;
    if (typeof msg === 'string' && msg) return msg;
  } catch { /* non-JSON */ }
  return fallback;
}

export function PortalLoginPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const tenantSlug = params.get('firm') ?? undefined;

  const [identifier, setIdentifier] = useState('');
  const [sentKind, setSentKind] = useState<Kind | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  const kind = identifierKind(identifier);

  const request = async (): Promise<boolean> => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/auth/request-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), tenantSlug }),
      });
      if (res.status === 429) {
        setError('Too many requests. Please wait a minute and try again.');
        return false;
      }
      if (!res.ok) {
        setError(await messageOf(res, 'Could not send your sign-in code. Try again shortly.'));
        return false;
      }
      return true;
    } catch {
      setError('Network error — check your connection and try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const submitIdentifier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kind) {
      setError('Enter a valid email address or mobile number.');
      return;
    }
    if (await request()) {
      setSentKind(kind);
      setCode('');
      setResent(false);
    }
  };

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/portal/auth/verify-code`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.trim(), code }),
      });
      if (res.status === 429) {
        setError('Too many attempts. Please wait a minute and try again.');
        return;
      }
      if (!res.ok) {
        setError(await messageOf(res, 'That code is not valid or has expired.'));
        return;
      }
      navigate('/portal', { replace: true });
    } catch {
      setError('Network error — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setSentKind(null);
    setIdentifier('');
    setCode('');
    setError(null);
  };

  const errorBox = error && (
    <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
      {error}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <h1 className="text-xl font-semibold text-gray-900">Sign in to your portal</h1>

        {sentKind ? (
          <>
            <p className="text-sm text-gray-600 mt-1">
              {sentKind === 'phone' ? 'Check your texts.' : 'Check your email.'} If{' '}
              <span className="font-medium text-gray-900 break-all">{identifier.trim()}</span> is on file, we sent a
              6-digit code{sentKind === 'phone' ? ' by text message' : ''}. It expires in 15 minutes.
            </p>
            <form onSubmit={submitCode} className="mt-6 space-y-4">
              <div>
                <label htmlFor="portal-code" className="block text-sm font-medium text-gray-800 mb-1">
                  Sign-in code
                </label>
                <input
                  id="portal-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-center text-2xl font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="000000"
                />
              </div>
              {errorBox}
              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm rounded-md py-2"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
              <p className="text-xs text-gray-500">
                You can also tap the link in the message. If you work with more than one firm or client, you'll get
                one message for each — use the code from the one you want to open.
              </p>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  disabled={loading}
                  onClick={async () => { if (await request()) setResent(true); }}
                  className="text-indigo-700 hover:underline disabled:opacity-50"
                >
                  {resent ? 'Sent again' : 'Send a new code'}
                </button>
                <button type="button" onClick={startOver} className="text-gray-600 hover:underline">
                  Use a different email or number
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mt-1">
              Enter your email or mobile number and we'll send you a one-time sign-in code.
            </p>
            <form onSubmit={submitIdentifier} className="mt-6 space-y-4">
              <div>
                <label htmlFor="portal-identifier" className="block text-sm font-medium text-gray-800 mb-1">
                  Email or mobile number
                </label>
                <input
                  id="portal-identifier"
                  type="text"
                  inputMode="email"
                  autoComplete="username"
                  required
                  autoFocus
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="you@company.com or (555) 123-4567"
                />
              </div>
              {errorBox}
              <button
                type="submit"
                disabled={loading || !identifier.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm rounded-md py-2"
              >
                {loading ? 'Sending…' : kind === 'phone' ? 'Text me a sign-in code' : kind === 'email' ? 'Email me a sign-in code' : 'Send me a sign-in code'}
              </button>
              <p className="text-xs text-gray-500 text-center">
                No password required. Each code is single-use and expires after 15 minutes.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default PortalLoginPage;
