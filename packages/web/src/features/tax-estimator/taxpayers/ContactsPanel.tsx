// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { useState } from 'react';
import { useTaxpayerContacts, useLinkContact, useUnlinkContact, useTaxpayerContactCandidates, useSetContactPortalOptions } from '../../../api/hooks/useTaxEstimatorTaxpayers';
import { PortalOptionsFields } from '../portal/PortalOptionsFields';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { SELECT_CLASS } from './labels';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Request failed');

/**
 * Portal contacts who may see this taxpayer's estimates. QA D11: the add picker lists the
 * active contacts of the taxpayer's LINKED client companies (any tenant in the firm's scope),
 * so it works from the practice tenant. QA D30: Remove (which revokes access) is confirmed.
 */
export function ContactsPanel({ taxpayerId, canWrite }: { taxpayerId: string; canWrite: boolean }) {
  const { data, isLoading, isError, refetch } = useTaxpayerContacts(taxpayerId);
  const candidates = useTaxpayerContactCandidates(taxpayerId, canWrite);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const link = useLinkContact(taxpayerId);
  const unlink = useUnlinkContact(taxpayerId);
  const setOptions = useSetContactPortalOptions(taxpayerId);
  // Q51: which contact's "What they see" editor is open.
  const [editing, setEditing] = useState<string | null>(null);
  const [pick, setPick] = useState('');
  const [grant, setGrant] = useState(true);
  const linked = new Set((data?.data ?? []).map((c) => c.portalContactId));
  const options = (candidates.data?.data ?? []).filter((c) => !linked.has(c.portalContactId));

  return (
    <section className="space-y-3" aria-label="Portal contacts">
      <h2 className="text-lg font-semibold text-gray-900">Portal contacts</h2>
      {isLoading ? <LoadingSpinner className="py-6" />
        : isError ? <ErrorMessage message="Could not load portal contacts." onRetry={() => refetch()} />
        : (data?.data.length ?? 0) === 0 ? <p className="text-sm text-gray-500">No portal contacts linked. Linked contacts can view this taxpayer's estimates in the client portal.</p>
        : (
          <ul className="divide-y rounded-lg border border-gray-200 bg-white">
            {data!.data.map((c) => (
              <li key={c.portalContactId} className="px-3 py-2 text-sm" data-testid="contact-row">
                <div className="flex items-center justify-between">
                  <span>
                    {c.outOfScope ? 'Contact in a client no longer managed by your firm' : `${[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email} (${c.email})`}
                    {c.taxEstimatesAccess && <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800">Estimates access</span>}
                  </span>
                  <span className="flex items-center gap-1">
                    {c.portalOptions && (
                      <Button variant="ghost" size="sm" aria-expanded={editing === c.portalContactId}
                        onClick={() => setEditing(editing === c.portalContactId ? null : c.portalContactId)}>What they see</Button>
                    )}
                    {canWrite && (
                      <Button variant="ghost" size="sm" disabled={unlink.isPending}
                        onClick={() => setRemoving({ id: c.portalContactId, name: c.outOfScope ? 'this contact' : ([c.firstName, c.lastName].filter(Boolean).join(' ') || c.email) })}>Remove</Button>
                    )}
                  </span>
                </div>
                {editing === c.portalContactId && c.portalOptions && (
                  <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2">
                    <PortalOptionsFields idPrefix={`tpo-${c.portalContactId}`} value={c.portalOptions} canGrant={canWrite}
                      disabled={!canWrite || setOptions.isPending}
                      onChange={(k, on) => setOptions.mutate({ portalContactId: c.portalContactId, options: { [k]: on } })} />
                  </div>
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
              {options.map((c) => (
                <option key={c.portalContactId} value={c.portalContactId}>
                  {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email}{c.companyNames.length ? ` — ${c.companyNames.join(', ')}` : ''}
                </option>
              ))}
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
      {canWrite && !candidates.isLoading && options.length === 0 && (
        <p className="text-xs text-gray-500">Only active portal contacts of this taxpayer&apos;s linked companies can be added. Add the contact in the client&apos;s Client Portal settings first.</p>
      )}
      {(link.isError || unlink.isError || setOptions.isError) && <p className="text-sm text-red-600" role="alert">{errMsg(link.error ?? unlink.error ?? setOptions.error)}</p>}
      <ConfirmDialog open={removing !== null} title="Remove portal contact?" variant="danger" confirmLabel="Remove"
        message={`${removing?.name ?? 'This contact'} will no longer see this taxpayer's estimates in the client portal (their tax estimates access is revoked).`}
        onCancel={() => setRemoving(null)}
        onConfirm={() => { if (removing) unlink.mutate({ portalContactId: removing.id, revokeAccess: true }); setRemoving(null); }} />
    </section>
  );
}
