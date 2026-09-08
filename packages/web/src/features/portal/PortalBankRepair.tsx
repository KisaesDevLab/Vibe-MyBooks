// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Client-portal bank-login repair (per-contact "Can fix bank logins"):
// a banner wherever a connection for the company needs a fresh sign-in,
// and a connections card on the banking view. "Fix" opens Plaid Link in
// update mode with a token minted by the portal API; on success the
// portal confirms server-side. OAuth banks leave the page — the state
// handoff in localStorage lets /connect/oauth-return finish the flow and
// bounce back here.

import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { AlertTriangle, CheckCircle, Landmark, RefreshCw } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { OAUTH_STATE_KEY } from '../public/BankConnectPage';
import { usePortal } from './PortalLayout';

export interface PortalConnection {
  plaidItemId: string;
  institutionName: string | null;
  itemStatus: string;
  needsAttention: boolean;
  message: string | null;
  lastSuccessAt: string | null;
  accounts: Array<{ name: string; mask: string | null }>;
}

const base = () => `${import.meta.env.BASE_URL}api/portal/banking/connections`;

// Shared fetch: null = feature/permission off (render nothing), [] = none.
export function usePortalConnections(companyId: string | null, enabled: boolean) {
  const [connections, setConnections] = useState<PortalConnection[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!companyId || !enabled) { setConnections(null); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`${base()}?companyId=${encodeURIComponent(companyId)}`, { credentials: 'include' })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        setConnections(d && d.featureEnabled !== false ? (d.connections as PortalConnection[]) : null);
      })
      .catch(() => { if (!cancelled) setConnections(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [companyId, enabled, attempt]);
  return { connections, loading, refresh: () => setAttempt((a) => a + 1) };
}

// One connection's Fix button: mints the update-mode token, opens Link,
// confirms on success. Renders its own inline status text.
export function FixBankLoginButton({ companyId, connection, onRepaired, compact }: {
  companyId: string;
  connection: PortalConnection;
  onRepaired: (healthy: boolean) => void;
  compact?: boolean;
}) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`${base()}/${encodeURIComponent(connection.plaidItemId)}/repair-complete?companyId=${encodeURIComponent(companyId)}`, {
        method: 'POST', credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body?.error?.message || 'The repair could not be confirmed. Please try again.'); return; }
      localStorage.removeItem(OAUTH_STATE_KEY);
      onRepaired(!!body.healthy);
    } catch {
      setError('Network problem while confirming the repair — please try again.');
    } finally {
      setBusy(false);
    }
  }, [companyId, connection.plaidItemId, onRepaired]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: () => { setLinkToken(null); void complete(); },
    onExit: () => { setLinkToken(null); setBusy(false); },
  });
  useEffect(() => { if (linkToken && ready) open(); }, [linkToken, ready, open]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${base()}/${encodeURIComponent(connection.plaidItemId)}/link-token?companyId=${encodeURIComponent(companyId)}`, {
        method: 'POST', credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body?.error?.message || 'Could not start the bank sign-in. Please try again.'); setBusy(false); return; }
      // Persist BEFORE Link opens — an OAuth bank navigates away entirely.
      localStorage.setItem(OAUTH_STATE_KEY, JSON.stringify({
        mode: 'portal', plaidItemId: connection.plaidItemId, companyId, linkToken: body.linkToken, ts: Date.now(),
      }));
      setLinkToken(body.linkToken);
    } catch {
      setError('Network problem — please try again.');
      setBusy(false);
    }
  };

  return (
    <div className={compact ? 'flex items-center gap-2' : 'space-y-1'}>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {busy ? <LoadingSpinner size="sm" /> : <RefreshCw className="h-4 w-4" />}
        {busy ? 'Working…' : 'Fix sign-in'}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

// Banner for the portal home + banking view: only when something needs
// attention; nothing rendered when all connections are healthy.
export function PortalBankRepairBanner({ companyId }: { companyId: string | null }) {
  const { me } = usePortal();
  const enabled = !!me.contact.companies.find((c) => c.companyId === companyId)?.bankRepairAccess;
  const { connections, refresh } = usePortalConnections(companyId, enabled);
  const [justFixed, setJustFixed] = useState<{ name: string | null; healthy: boolean } | null>(null);
  if (!enabled || !companyId) return null;
  const broken = (connections ?? []).filter((c) => c.needsAttention);
  if (justFixed) {
    return (
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        <CheckCircle className="h-5 w-5 shrink-0" />
        <p>
          Thanks — {justFixed.name ?? 'your bank'} is signed in again.
          {justFixed.healthy ? ' Transactions will start flowing shortly.' : ' Your accountant’s next sync will confirm the fix.'}
        </p>
      </div>
    );
  }
  if (broken.length === 0) return null;
  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      {broken.map((c) => (
        <div key={c.plaidItemId} className="flex flex-wrap items-center justify-between gap-3 py-1">
          <div className="flex items-start gap-3 min-w-0">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-900">{c.institutionName ?? 'Your bank'} needs you to sign in again</p>
              <p className="text-xs text-amber-800">{c.message ?? 'Sign in to keep your transactions flowing to your accountant.'}</p>
            </div>
          </div>
          <FixBankLoginButton companyId={companyId} connection={c} compact
            onRepaired={(healthy) => { setJustFixed({ name: c.institutionName, healthy }); refresh(); }} />
        </div>
      ))}
    </div>
  );
}

// Connections card for the banking view: every institution linked to the
// company with a status line and a Fix button where needed.
export function PortalConnectionsCard({ companyId }: { companyId: string | null }) {
  const { me } = usePortal();
  const enabled = !!me.contact.companies.find((c) => c.companyId === companyId)?.bankRepairAccess;
  const { connections, loading, refresh } = usePortalConnections(companyId, enabled);
  if (!enabled || !companyId || (!loading && connections === null)) return null;
  return (
    <section className="mt-8">
      <h2 className="text-base font-semibold text-gray-900 mb-1">Bank connections</h2>
      <p className="text-xs text-gray-500 mb-3">
        The bank logins that feed your activity to your accountant. When a bank asks for a fresh sign-in, fix it here.
      </p>
      {loading && !connections ? (
        <LoadingSpinner className="py-4" />
      ) : (connections ?? []).length === 0 ? (
        <p className="text-sm text-gray-500 border border-dashed border-gray-300 rounded-lg p-4 text-center">No bank connections yet.</p>
      ) : (
        <ul className="space-y-2">
          {(connections ?? []).map((c) => (
            <li key={c.plaidItemId} className={`rounded-lg border p-3 ${c.needsAttention ? 'border-amber-200 bg-amber-50/50' : 'border-gray-200 bg-white'}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="shrink-0 h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center">
                    <Landmark className="h-4 w-4 text-gray-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{c.institutionName ?? 'Bank'}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {c.accounts.map((a) => `${a.name}${a.mask ? ` ••${a.mask}` : ''}`).join(' · ')}
                    </p>
                    <p className={`text-xs mt-0.5 ${c.needsAttention ? 'text-amber-800' : 'text-green-700'}`}>
                      {c.needsAttention
                        ? (c.message ?? 'Needs attention')
                        : c.lastSuccessAt ? `Connected · last updated ${new Date(c.lastSuccessAt).toLocaleDateString()}` : 'Connected'}
                    </p>
                  </div>
                </div>
                {c.needsAttention && (
                  <FixBankLoginButton companyId={companyId} connection={c} compact onRepaired={() => refresh()} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
