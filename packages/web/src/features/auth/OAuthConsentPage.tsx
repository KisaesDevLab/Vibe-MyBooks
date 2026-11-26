// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Button } from '../../components/ui/Button';
import { AlertTriangle, CheckCircle, Shield } from 'lucide-react';
import { APP_BASE, getAccessToken, refreshAccessToken } from '../../api/client';
import { rememberPostLoginRedirect } from '../../utils/postLoginRedirect';

// The consent screen of the OAuth sign-in an MCP connector (Claude, for
// example) starts. GET /oauth/authorize on the API checks the request and
// sends the browser here with one signed `request` value. Everything shown
// below is read back from the server with that value, and the decision is
// posted with it, so nothing on this page can be altered through the URL.

const SCOPE_LABELS: Record<string, string> = {
  read: 'Read accounts, contacts, transactions and other records',
  write: 'Enter, change and void transactions',
  reports: 'Run financial reports',
  banking: 'Work the bank feed and reconcile accounts',
  invoicing: 'Create and send invoices, and record customer payments',
};

interface RequestDetails {
  clientName: string;
  isDynamic: boolean;
  redirectUri: string;
  redirectHost: string;
  redirectIsThisComputer: boolean;
  scopes: string[];
}

type Loaded =
  | { state: 'loading' }
  | { state: 'ready'; details: RequestDetails }
  | { state: 'invalid'; message: string }
  | { state: 'failed'; message: string };

const OAUTH_BASE = `${APP_BASE}/oauth`;

function messageOf(body: unknown, fallback: string): string {
  if (body && typeof body === 'object') {
    const o = body as { error_description?: unknown; error?: unknown };
    if (typeof o.error_description === 'string') return o.error_description;
    if (o.error && typeof o.error === 'object' && typeof (o.error as { message?: unknown }).message === 'string') {
      return (o.error as { message: string }).message;
    }
  }
  return fallback;
}

export function OAuthConsentPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const request = params.get('request') || '';
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [deciding, setDeciding] = useState<'approve' | 'deny' | null>(null);
  const [error, setError] = useState('');

  const signInFirst = useCallback(() => {
    rememberPostLoginRedirect(`/oauth/consent?request=${encodeURIComponent(request)}`);
    navigate('/login', { replace: true });
  }, [navigate, request]);

  const load = useCallback(async () => {
    if (!request) {
      setLoaded({ state: 'invalid', message: 'This sign-in link is not complete. Start again from the app you are connecting.' });
      return;
    }
    setLoaded({ state: 'loading' });
    try {
      const res = await fetch(`${OAUTH_BASE}/authorize/details?request=${encodeURIComponent(request)}`);
      const body: unknown = await res.json().catch(() => null);
      if (res.ok) {
        setLoaded({ state: 'ready', details: body as RequestDetails });
      } else if (res.status >= 500) {
        setLoaded({ state: 'failed', message: 'The server could not be reached. Try again.' });
      } else {
        setLoaded({ state: 'invalid', message: messageOf(body, 'This sign-in request is no longer valid. Start again from the app you are connecting.') });
      }
    } catch {
      setLoaded({ state: 'failed', message: 'The server could not be reached. Try again.' });
    }
  }, [request]);

  useEffect(() => {
    // Approving needs a signed-in user: send them to sign in and bring them
    // back here. A session whose access token has lapsed is renewed first.
    let cancelled = false;
    (async () => {
      if (request && !getAccessToken() && !(await refreshAccessToken().catch(() => null))) {
        if (!cancelled) signInFirst();
        return;
      }
      if (!cancelled) await load();
    })();
    return () => { cancelled = true; };
  }, [load, request, signInFirst]);

  const decide = async (approve: boolean) => {
    setDeciding(approve ? 'approve' : 'deny');
    setError('');
    try {
      const send = () => fetch(`${OAUTH_BASE}/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAccessToken() ?? ''}` },
        body: JSON.stringify({ request, approve }),
      });
      let res = await send();
      if (res.status === 401 && (await refreshAccessToken().catch(() => null))) res = await send();
      if (res.status === 401) {
        signInFirst();
        return;
      }
      const body: unknown = await res.json().catch(() => null);
      const redirectTo = body && typeof body === 'object' ? (body as { redirect_to?: unknown }).redirect_to : undefined;
      if (!res.ok || typeof redirectTo !== 'string') {
        setError(messageOf(body, 'The request could not be completed. Start again from the app you are connecting.'));
        return;
      }
      // Back to the connecting app, with its code (or the refusal).
      window.location.assign(redirectTo);
    } catch {
      setError('The server could not be reached. Try again.');
    } finally {
      setDeciding(null);
    }
  };

  if (loaded.state === 'loading') {
    return (
      <AuthLayout title="Connect an app" subtitle="Checking the request">
        <div className="space-y-3 animate-pulse" role="status" aria-label="Loading">
          <div className="h-20 rounded-lg bg-gray-100" />
          <div className="h-4 w-2/3 rounded bg-gray-100" />
          <div className="h-4 w-1/2 rounded bg-gray-100" />
          <div className="h-10 rounded bg-gray-100" />
        </div>
      </AuthLayout>
    );
  }

  if (loaded.state !== 'ready') {
    return (
      <AuthLayout title="Connect an app" subtitle={loaded.state === 'invalid' ? 'This request cannot be used' : 'Something went wrong'}>
        <div className="space-y-4">
          <p className="text-sm text-red-600" role="alert">{loaded.message}</p>
          {loaded.state === 'failed' && <Button onClick={() => { void load(); }} className="w-full">Try again</Button>}
        </div>
      </AuthLayout>
    );
  }

  const { details } = loaded;
  const destination = details.redirectIsThisComputer ? 'an app on this computer' : details.redirectHost;

  return (
    <AuthLayout title="Connect an app" subtitle="An app is asking to work in your books as you">
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <Shield className="h-8 w-8 text-primary-600 mx-auto mb-2" />
          <p className="text-base font-semibold text-gray-900 break-words">{details.clientName}</p>
          <p className="text-xs text-gray-500 mt-1">
            After you approve, your sign-in is sent to <span className="font-medium text-gray-700 break-all">{destination}</span>
          </p>
        </div>

        {details.isDynamic && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              This app gave its own name; nobody has checked it. Approve only if you started this yourself, just now,
              from the app you are connecting, and the address above is the one you expect.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">It will be able to:</p>
          {details.scopes.map((s) => (
            <div key={s} className="flex items-start gap-2 text-sm text-gray-600">
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <span>{SCOPE_LABELS[s] || s}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-500">
          It acts as you, in every company you can open, with the rights you have in each one and no more.
          Companies that have not turned on MCP access stay closed to it.
        </p>

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        <div className="flex gap-3">
          <Button onClick={() => { void decide(true); }} loading={deciding === 'approve'} disabled={deciding !== null} className="flex-1">Authorize</Button>
          <Button variant="secondary" onClick={() => { void decide(false); }} loading={deciding === 'deny'} disabled={deciding !== null} className="flex-1">Deny</Button>
        </div>

        <p className="text-xs text-gray-400 text-center">You can revoke access at any time from Settings → Connected Apps</p>
      </div>
    </AuthLayout>
  );
}
