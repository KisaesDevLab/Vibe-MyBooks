// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 9.3 — magic-link verify.
// Reads ?token=…, exchanges for a session cookie, redirects to dashboard.

export function PortalVerifyPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Missing sign-in token. Use the link from your email.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/portal/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          credentials: 'include',
        });
        if (cancelled) return;
        if (res.status === 401) {
          setError(
            'This sign-in link is invalid or expired. Request a new one and check your email again.',
          );
          return;
        }
        if (!res.ok) {
          setError('Sign-in failed. Please request a new link.');
          return;
        }
        navigate('/portal', { replace: true });
      } catch {
        if (!cancelled) setError('Network error. Try again shortly.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-sm p-6 text-center">
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-gray-900">Sign-in failed</h1>
            <p className="mt-2 text-sm text-gray-700">{error}</p>
            <button
              onClick={() => navigate('/portal/login', { replace: true })}
              className="mt-4 inline-block text-sm font-medium text-indigo-700 hover:underline"
            >
              Request a new sign-in link
            </button>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-gray-900">Signing you in…</h1>
            <p className="mt-2 text-sm text-gray-600">One moment.</p>
          </>
        )}
      </div>
    </div>
  );
}

export default PortalVerifyPage;
