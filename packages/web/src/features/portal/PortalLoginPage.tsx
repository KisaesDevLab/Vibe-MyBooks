// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 9.2 — request a magic link.
// The request endpoint always returns ok regardless of whether the
// email matches an active contact, so this page never reveals
// account existence.

export function PortalLoginPage() {
  const [params] = useSearchParams();
  const tenantSlug = params.get('firm') ?? undefined;

  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/portal/auth/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tenantSlug }),
      });
      if (res.status === 429) {
        setError('Too many requests. Please wait a minute and try again.');
        return;
      }
      if (!res.ok) {
        setError('Could not send the sign-in link. Try again shortly.');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Network error — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-sm p-6">
        <h1 className="text-xl font-semibold text-gray-900">Sign in to your portal</h1>
        <p className="text-sm text-gray-600 mt-1">
          We'll email you a one-time link to access your account.
        </p>

        {submitted ? (
          <div className="mt-6 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <p className="font-medium">Check your email.</p>
            <p className="mt-1">
              If <span className="font-mono">{email}</span> is on file, a sign-in link is on its
              way. The link expires in 15 minutes.
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                setEmail('');
              }}
              className="mt-3 text-green-800 underline text-xs"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="portal-email" className="block text-sm font-medium text-gray-800 mb-1">
                Email address
              </label>
              <input
                id="portal-email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="you@company.com"
              />
            </div>
            {error && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm rounded-md py-2"
            >
              {loading ? 'Sending…' : 'Email me a sign-in link'}
            </button>
            <p className="text-xs text-gray-500 text-center">
              No password required. Each link is single-use and expires after 15 minutes.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

export default PortalLoginPage;
