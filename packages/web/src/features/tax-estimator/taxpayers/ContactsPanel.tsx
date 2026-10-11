// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { useTaxpayerContacts, useLinkContact, useUnlinkContact } from '../../../api/hooks/useTaxEstimatorTaxpayers';
import { usePortalContacts } from '../../../api/hooks/usePortalContacts';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { SELECT_CLASS } from './labels';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Request failed');

/**
 * Portal contacts who may see this taxpayer's estimates. The add picker lists the ACTIVE
 * tenant's portal contacts; the API accepts a contact from any tenant in the firm's scope.
 */
export function ContactsPanel({ taxpayerId, canWrite }: { taxpayerId: string; canWrite: boolean }) {
  const { data, isLoading, isError, refetch } = useTaxpayerContacts(taxpayerId);
  const candidates = usePortalContacts({ status: 'active' });
  const link = useLinkContact(taxpayerId);
  const unlink = useUnlinkContact(taxpayerId);
  const [pick, setPick] = useState('');
  const [grant, setGrant] = useState(true);
  const linked = new Set((data?.data ?? []).map((c) => c.portalContactId));
  const options = (candidates.data?.contacts ?? []).filter((c) => !linked.has(c.id));

  return (
    <section className="space-y-3" aria-label="Portal contacts">
      <h2 className="text-lg font-semibold text-gray-900">Portal contacts</h2>
      {isLoading ? <LoadingSpinner className="py-6" />
        : isError ? <ErrorMessage message="Could not load portal contacts." onRetry={() => refetch()} />
        : (data?.data.length ?? 0) === 0 ? <p className="text-sm text-gray-500">No portal contacts linked. Linked contacts can view this taxpayer's estimates in the client portal.</p>
        : (
          <ul className="divide-y rounded-lg border border-gray-200 bg-white">
            {data!.data.map((c) => (
              <li key={c.portalContactId} className="flex items-center justify-between px-3 py-2 text-sm" data-testid="contact-row">
                <span>
                  {c.outOfScope ? 'Contact in a client no longer managed by your firm' : `${[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email} (${c.email})`}
                  {c.taxEstimatesAccess && <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">Estimates access</span>}
                </span>
                {canWrite && (
                  <Button variant="ghost" size="sm" disabled={unlink.isPending}
                    onClick={() => unlink.mutate({ portalContactId: c.portalContactId, revokeAccess: true })}>Remove</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      {canWrite && (
        <div className="flex items-end gap-3 flex-wrap">
          <div className="min-w-[16rem]">
            <label htmlFor="contact-pick" className="block text-sm font-medium text-gray-700 mb-1">Add portal contact</label>
            <select id="contact-pick" className={SELECT_CLASS} value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">{candidates.isLoading ? 'Loading…' : options.length === 0 ? 'No contacts available' : 'Select a contact'}</option>
              {options.map((c) => <option key={c.id} value={c.id}>{[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
            <input type="checkbox" checked={grant} onChange={(e) => setGrant(e.target.checked)} />
            Grant tax estimates access
          </label>
          <Button size="sm" disabled={!pick} loading={link.isPending}
            onClick={() => link.mutate({ portalContactId: pick, grantAccess: grant }, { onSuccess: () => setPick('') })}>Add contact</Button>
        </div>
      )}
      {(link.isError || unlink.isError) && <p className="text-sm text-red-600" role="alert">{errMsg(link.error ?? unlink.error)}</p>}
    </section>
  );
}
