// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Fixed OAuth return page for bank-connect invites (/connect/oauth-return —
// the dashboard-registered Plaid redirect URI, which must be one exact URL,
// so it can't carry the invite token in the path). Resumes the Link session
// from the localStorage handoff written by BankConnectPage just before
// open(): re-initializes Link with the SAME link_token plus
// receivedRedirectUri, exchanges on success, and bounces back to the invite
// page with ?done=1.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlaidLink } from 'react-plaid-link';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { AlertTriangle } from 'lucide-react';
import { OAUTH_STATE_KEY } from './BankConnectPage';

const MAX_STATE_AGE_MS = 4 * 60 * 60 * 1000;

interface OAuthState { inviteToken: string; linkToken: string; kind?: 'connect' | 'repair'; ts: number }

export function BankConnectOAuthReturnPage() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState<string | null>(null);

  const state = useMemo<OAuthState | null>(() => {
    try {
      const raw = localStorage.getItem(OAUTH_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as OAuthState;
      if (!parsed.inviteToken || !parsed.linkToken) return null;
      if (Date.now() - (parsed.ts ?? 0) > MAX_STATE_AGE_MS) return null;
      return parsed;
    } catch { return null; }
  }, []);

  const { open, ready } = usePlaidLink({
    token: state?.linkToken ?? null,
    receivedRedirectUri: state ? window.location.href : undefined,
    onSuccess: (publicToken, metadata) => {
      void (async () => {
        try {
          // Repair invites ran Link in update mode — the item is already
          // fixed at Plaid; confirm server-side instead of exchanging.
          const res = state!.kind === 'repair'
            ? await fetch(`/api/bank-connect/${encodeURIComponent(state!.inviteToken)}/repair-complete`, { method: 'POST' })
            : await fetch(`/api/bank-connect/${encodeURIComponent(state!.inviteToken)}/exchange`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                publicToken,
                institutionId: metadata.institution?.institution_id,
                institutionName: metadata.institution?.name,
                accounts: metadata.accounts,
                linkSessionId: metadata.link_session_id,
              }),
            });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            setFailed(body?.error?.message || 'The connection could not be saved.');
            return;
          }
          localStorage.removeItem(OAUTH_STATE_KEY);
          navigate(`/connect/${encodeURIComponent(state!.inviteToken)}?done=1`, { replace: true });
        } catch {
          setFailed('Network problem while saving the connection.');
        }
      })();
    },
    onExit: () => {
      // Bank declined / user backed out — return to the invite landing page.
      if (state) navigate(`/connect/${encodeURIComponent(state.inviteToken)}`, { replace: true });
      else setFailed('The bank connection was not completed.');
    },
  });

  useEffect(() => {
    if (state && ready) open();
  }, [state, ready, open]);

  if (!state || failed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-full max-w-lg p-8 text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <h1 className="text-xl font-bold text-gray-900">Almost there</h1>
          <p className="text-sm text-gray-600">
            {failed ?? 'We couldn’t resume your bank connection on this device. Please reopen the link from your email or text message on the same device and browser you started with, then try again.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center space-y-3">
        <LoadingSpinner className="py-4" />
        <p className="text-sm text-gray-600">Finishing your bank connection…</p>
      </div>
    </div>
  );
}
