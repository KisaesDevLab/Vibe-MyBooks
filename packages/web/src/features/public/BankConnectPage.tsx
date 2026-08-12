// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Public bank-connect invite landing page (/connect/:token). The token in
// the URL is the only auth surface; everything else (expiry, revocation,
// rate limits) is enforced server-side by /api/bank-connect. Runs Plaid
// Link directly in the page (W-9 page structure + the PlaidLinkButton
// deferred-open pattern from BankConnectionsPage).
//
// OAuth institutions bounce through the bank's site and return to the
// FIXED registered URI /connect/oauth-return, so before opening Link we
// persist { inviteToken, linkToken, ts } in localStorage for that page to
// resume from (see BankConnectOAuthReturnPage).

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { usePlaidLink, type PlaidLinkOnSuccessMetadata } from 'react-plaid-link';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Landmark, ShieldCheck, CheckCircle, AlertTriangle } from 'lucide-react';

export const OAUTH_STATE_KEY = 'vmb.bankConnect.oauth';

interface InviteMeta {
  status: string;
  kind: 'connect' | 'repair';
  recipientName: string;
  firmName: string;
  institutionName: string | null;
  expiresAt: string;
  connectionsCount: number;
}

type Status = 'loading' | 'ready' | 'exchanging' | 'connected' | 'expired' | 'revoked' | 'error';

export function BankConnectPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>('loading');
  const [meta, setMeta] = useState<InviteMeta | null>(null);
  const [error, setError] = useState('');
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [lastResult, setLastResult] = useState<{ institutionName: string | null; accountCount: number } | null>(null);

  const loadInvite = useCallback(async (afterConnect = false) => {
    if (!token) { setStatus('error'); setError('Missing invite token.'); return; }
    try {
      const res = await fetch(`/api/bank-connect/${encodeURIComponent(token)}`);
      const body = await res.json().catch(() => ({}));
      if (res.status === 404) {
        setStatus('error');
        setError('This link is not valid. Please ask your accountant to send a new one.');
        return;
      }
      if (!res.ok) {
        const code = body?.error?.code;
        if (code === 'EXPIRED') { setStatus('expired'); return; }
        if (code === 'REVOKED') { setStatus('revoked'); return; }
        setStatus('error');
        setError(body?.error?.message || 'Could not load this invite.');
        return;
      }
      setMeta(body.invite);
      setStatus(afterConnect ? 'connected' : 'ready');
    } catch {
      setStatus('error');
      setError('Network problem — please try again.');
    }
  }, [token]);

  useEffect(() => {
    // Returning from the OAuth round-trip with ?done=1 → show success.
    void loadInvite(searchParams.get('done') === '1');
  }, [loadInvite, searchParams]);

  const exchange = useCallback(async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
    setStatus('exchanging');
    try {
      const res = await fetch(`/api/bank-connect/${encodeURIComponent(token!)}/exchange`, {
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
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setError(body?.error?.message || 'The connection could not be saved. Please try again.');
        return;
      }
      setLastResult({ institutionName: body.institutionName ?? null, accountCount: body.accountCount ?? 0 });
      localStorage.removeItem(OAUTH_STATE_KEY);
      await loadInvite(true);
    } catch {
      setStatus('error');
      setError('Network problem while saving the connection — please try again.');
    }
  }, [token, loadInvite]);

  // Repair invites finish differently: update mode fixed the login inside
  // Link, so there's no public token to exchange — just confirm server-side.
  const repairComplete = useCallback(async () => {
    setStatus('exchanging');
    try {
      const res = await fetch(`/api/bank-connect/${encodeURIComponent(token!)}/repair-complete`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setError(body?.error?.message || 'The repair could not be confirmed. Please try again.');
        return;
      }
      setLastResult({ institutionName: body.institutionName ?? null, accountCount: 0 });
      localStorage.removeItem(OAUTH_STATE_KEY);
      await loadInvite(true);
    } catch {
      setStatus('error');
      setError('Network problem while confirming the repair — please try again.');
    }
  }, [token, loadInvite]);

  const isRepair = meta?.kind === 'repair';

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (pt, m) => { setLinkToken(null); isRepair ? void repairComplete() : void exchange(pt, m); },
    onExit: () => setLinkToken(null),
  });
  if (linkToken && ready) setTimeout(() => open(), 0);

  const startConnect = async () => {
    if (!token) return;
    setMinting(true);
    setError('');
    try {
      const res = await fetch(`/api/bank-connect/${encodeURIComponent(token)}/link-token`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body?.error?.message || 'Could not start the connection. Please try again.');
        return;
      }
      // Persist for the OAuth return page BEFORE Link opens — an OAuth bank
      // navigates away from this page entirely. kind tells that page whether
      // to exchange (connect) or just confirm (repair).
      localStorage.setItem(OAUTH_STATE_KEY, JSON.stringify({ inviteToken: token, linkToken: body.linkToken, kind: meta?.kind ?? 'connect', ts: Date.now() }));
      setLinkToken(body.linkToken);
    } finally {
      setMinting(false);
    }
  };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm w-full max-w-lg p-8">
        {children}
      </div>
    </div>
  );

  if (status === 'loading') return <Shell><LoadingSpinner className="py-10" /></Shell>;

  if (status === 'expired' || status === 'revoked' || status === 'error') {
    return (
      <Shell>
        <div className="text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <h1 className="text-xl font-bold text-gray-900">
            {status === 'expired' ? 'This link has expired' : status === 'revoked' ? 'This link is no longer active' : 'Something went wrong'}
          </h1>
          <p className="text-sm text-gray-600">
            {status === 'expired'
              ? 'For your security, bank connection links are only valid for a limited time. Please ask your accountant to send a fresh one.'
              : status === 'revoked'
                ? 'Your accountant deactivated this link. If you still need to connect an account, ask them for a new one.'
                : error}
          </p>
        </div>
      </Shell>
    );
  }

  const connectedAlready = (meta?.connectionsCount ?? 0) > 0;

  return (
    <Shell>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary-50 rounded-lg"><Landmark className="h-6 w-6 text-primary-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{meta?.firmName}</h1>
            <p className="text-sm text-gray-500">{isRepair ? 'Bank connection repair' : 'Secure bank connection'}</p>
          </div>
        </div>

        {status === 'connected' ? (
          <div className="text-center space-y-3 py-2">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-lg font-semibold text-gray-900">{isRepair ? 'Connection restored!' : "You're all set!"}</h2>
            <p className="text-sm text-gray-600">
              {isRepair
                ? `Your ${lastResult?.institutionName || meta?.institutionName || 'bank'} login has been updated and transactions will resume shortly. `
                : lastResult?.institutionName
                  ? `${lastResult.institutionName} is connected${lastResult.accountCount ? ` (${lastResult.accountCount} account${lastResult.accountCount === 1 ? '' : 's'})` : ''}. `
                  : 'Your bank is connected. '}
              {meta?.firmName} has been notified — you can close this page.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-700">Hi {meta?.recipientName},</p>
            <p className="text-sm text-gray-600">
              {isRepair
                ? `${meta?.institutionName || 'Your bank'} has stopped sharing transactions with ${meta?.firmName} — this usually happens after a password change or a security update at your bank. Updating your login takes about a minute.`
                : `${meta?.firmName} has asked you to connect your bank account so your bookkeeping stays accurate and up to date. It takes about two minutes.`}
            </p>
            {!isRepair && connectedAlready && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                {meta!.connectionsCount} account connection{meta!.connectionsCount === 1 ? '' : 's'} already made with this link — you can add another bank below.
              </p>
            )}
          </div>
        )}

        <button
          onClick={startConnect}
          disabled={minting || status === 'exchanging'}
          className="w-full bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-medium rounded-lg px-4 py-3 text-sm"
        >
          {status === 'exchanging'
            ? (isRepair ? 'Confirming the repair…' : 'Saving your connection…')
            : minting ? 'Starting…'
              : isRepair ? (status === 'connected' ? 'Update login again' : 'Fix bank connection')
                : status === 'connected' || connectedAlready ? 'Connect another bank' : 'Connect your bank'}
        </button>
        {error && status === 'ready' && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-start gap-2 text-xs text-gray-500 border-t pt-4">
          <ShieldCheck className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
          <p>
            The connection is made through Plaid, the same service used by major financial apps.
            Your banking credentials go directly to your bank — {meta?.firmName} never sees your
            username or password.
          </p>
        </div>
      </div>
    </Shell>
  );
}
