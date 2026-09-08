// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Shared accept flow for a client's accountant invitation: preview the
// invite (company, inviter, expiry, current firm), pick a firm when the
// staffer belongs to several, accept. Used by the emailed-link page
// (/accept-firm-invite/:token) and the code page (/firm/join).

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, CircleCheck } from 'lucide-react';
import type { AcceptFirmInviteResult, FirmInvitePreview } from '@kis-books/shared';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { isApiError, clearTokens } from '../../api/client';
import { useAcceptFirmInvite, useLookupFirmInvite, type FirmInviteLookup } from '../../api/hooks/useFirmInvites';

function describeError(err: unknown): { title: string; body: string; signOut?: boolean } {
  const code = isApiError(err) ? err.code : undefined;
  const msg = err instanceof Error ? err.message : 'Something went wrong.';
  switch (code) {
    case 'EXPIRED':
      return { title: 'This invitation has expired', body: 'Ask the client to resend it from Settings → Team.' };
    case 'REVOKED':
      return { title: 'This invitation was revoked', body: 'Ask the client to send a new one.' };
    case 'ALREADY_ACCEPTED':
      return { title: 'Already accepted', body: 'This invitation was already used. The client should appear in your company switcher.' };
    case 'INVITE_EMAIL_MISMATCH':
      return { title: 'Wrong account', body: msg, signOut: true };
    case 'FIRM_MEMBERSHIP_REQUIRED':
      return { title: 'Firm membership required', body: msg };
    case 'RATE_LIMIT':
      return { title: 'Too many attempts', body: 'Wait 15 minutes and try again.' };
    default:
      return { title: 'Invitation not found', body: 'The link or code is invalid. Check for typos, or ask the client to resend the invitation.' };
  }
}

export function FirmInviteAcceptCard({ lookup }: { lookup: FirmInviteLookup }) {
  const preview = useLookupFirmInvite();
  const accept = useAcceptFirmInvite();
  const [firmId, setFirmId] = useState('');
  const [data, setData] = useState<FirmInvitePreview | null>(null);
  const [done, setDone] = useState<AcceptFirmInviteResult | null>(null);

  const key = 'token' in lookup ? lookup.token : lookup.code;
  useEffect(() => {
    setData(null);
    setDone(null);
    preview.mutate(lookup, {
      onSuccess: (p) => {
        setData(p);
        setFirmId(p.firms.length === 1 ? p.firms[0]!.id : '');
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-5">
        <div className="flex items-start gap-3">
          <CircleCheck className="h-6 w-6 text-green-600 flex-shrink-0" />
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {done.tenantName} is now managed by {done.firmName}
            </h2>
            <p className="text-sm text-gray-700 mt-1">
              {done.accessGranted
                ? 'You have accountant access to their books — the company now appears in your company switcher.'
                : done.alreadyAssigned
                  ? 'You already had access, and the client was already on this firm.'
                  : 'You already had access to their books.'}
            </p>
            <div className="mt-3 flex gap-3">
              <Link to={`/firm/${done.firmId}/tenants`} className="text-sm font-medium text-primary-700 hover:text-primary-800">
                View managed tenants &rarr;
              </Link>
              <Link to="/clients" className="text-sm font-medium text-primary-700 hover:text-primary-800">
                Open Clients &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (preview.isPending || (!data && !preview.isError)) {
    return <div className="py-8 flex justify-center"><LoadingSpinner size="md" /></div>;
  }

  if (preview.isError || !data) {
    const e = describeError(preview.error);
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-base font-semibold text-gray-900">{e.title}</h2>
        <p className="text-sm text-gray-700 mt-1">{e.body}</p>
        {e.signOut && (
          <button
            type="button"
            className="mt-3 text-sm font-medium text-primary-700 hover:text-primary-800"
            onClick={() => { clearTokens(); window.location.assign('/login'); }}
          >
            Sign out and switch accounts &rarr;
          </button>
        )}
      </div>
    );
  }

  const acceptErr = accept.isError ? describeError(accept.error) : null;
  const canAccept = data.firms.length <= 1 || !!firmId;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Building2 className="h-6 w-6 text-indigo-600 flex-shrink-0" />
        <div>
          <h2 className="text-base font-semibold text-gray-900">{data.tenantName}</h2>
          <p className="text-sm text-gray-600">
            {data.inviterName || data.inviterEmail || 'The owner'}
            {data.inviterEmail && data.inviterName ? ` (${data.inviterEmail})` : ''} invited you to be their accountant.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Expires {new Date(data.expiresAt).toLocaleDateString()}
            {data.currentFirmName ? ` · currently managed by ${data.currentFirmName}` : ' · not currently managed by a firm'}
          </p>
        </div>
      </div>

      <div className="rounded-md bg-gray-50 border border-gray-200 p-3 text-xs text-gray-700">
        Accepting assigns <strong>{data.tenantName}</strong> to your firm
        {data.currentFirmName ? ` (moving it off ${data.currentFirmName})` : ''} and gives you accountant
        access to its books. Your firm&apos;s admins get access automatically.
      </div>

      {data.firms.length > 1 && (
        <div>
          <label htmlFor="accept-firm" className="block text-sm font-medium text-gray-700 mb-1">Accept into which firm?</label>
          <select
            id="accept-firm"
            value={firmId}
            onChange={(e) => setFirmId(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Choose a firm…</option>
            {data.firms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
      )}
      {data.firms.length === 1 && (
        <p className="text-sm text-gray-700">Firm: <strong>{data.firms[0]!.name}</strong></p>
      )}

      {acceptErr && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <strong>{acceptErr.title}.</strong> {acceptErr.body}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => accept.mutate({ ...lookup, ...(firmId ? { firmId } : {}) }, { onSuccess: setDone })}
          loading={accept.isPending}
          disabled={!canAccept}
        >
          Accept invitation
        </Button>
      </div>
    </div>
  );
}
