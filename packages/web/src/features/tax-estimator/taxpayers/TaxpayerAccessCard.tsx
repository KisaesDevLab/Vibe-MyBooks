// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import type { TaxpayerStaffDTO } from '@kis-books/shared';
import {
  useTaxpayerStaff, useTaxpayerStaffCandidates, useReplaceTaxpayerStaff,
} from '../../../api/hooks/useTaxEstimatorTaxpayers';
import { useMe } from '../../../api/hooks/useAuth';
import { isApiError } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { SELECT_CLASS } from './labels';

const errMsg = (e: unknown) => {
  if (isApiError(e) && e.code === 'TE_STAFF_LIST_NO_MANAGER') {
    return 'Keep at least one firm administrator on the list, or nobody could manage it.';
  }
  return e instanceof Error ? e.message : 'Request failed';
};
const ROLE_LABEL: Record<string, string> = { firm_staff: 'Staff', firm_readonly: 'Read-only', firm_admin: 'Admin' };

/**
 * D17 / D18 / Q54 "Who can see this taxpayer". Firm admins who can see the taxpayer (and super
 * admins) edit the staff list; everyone else sees it read-only. Empty list = the firm rule; a
 * non-empty list REPLACES it: only the listed people and super admins — firm admins included —
 * see the taxpayer, with all of its linked companies. A list must keep a firm admin on it (the
 * server answers 422 TE_STAFF_LIST_NO_MANAGER); removing yourself asks first, and a save that
 * drops your own access returns you to the taxpayer list. The server enforces every rule
 * (firm-scope.service visibleTaxpayerFilter / scopeForTaxpayer); this card explains and edits.
 */
export function TaxpayerAccessCard({ taxpayerId }: { taxpayerId: string }) {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const myId = me?.user?.id;
  const isSuperAdmin = me?.user?.isSuperAdmin === true;
  const staff = useTaxpayerStaff(taxpayerId);
  const canEdit = staff.data?.canEdit === true;
  const candidates = useTaxpayerStaffCandidates(taxpayerId, canEdit);
  const save = useReplaceTaxpayerStaff(taxpayerId);
  const [pick, setPick] = useState('');
  const [pendingSelfRemoval, setPendingSelfRemoval] = useState<string[] | null>(null);

  const members = staff.data?.members ?? [];
  const memberIds = members.map((m) => m.userId);
  const options = (candidates.data?.data ?? []).filter((c) => !memberIds.includes(c.userId));
  const rule = staff.data?.restrictToLinkedTenants
    ? 'staff granted "Tax Estimator: view taxpayers" who can reach at least one client company this taxpayer is linked to'
    : 'staff granted "Tax Estimator: view taxpayers"';
  // Q54: the first entry of a new list brings the editing firm admin along (a list needs a manager).
  const meCandidate = !isSuperAdmin && (candidates.data?.data ?? []).some((c) => c.userId === myId);

  const submit = (ids: string[], onDone?: () => void) => save.mutate(ids, {
    onSuccess: (dto: TaxpayerStaffDTO) => {
      onDone?.();
      if (dto.callerLostAccess) navigate('/tax-estimator/taxpayers');
    },
  });
  /** Saving `ids` would drop the caller's own access (not a super admin, non-empty list without them). */
  const losesAccess = (ids: string[]) => !isSuperAdmin && !!myId && ids.length > 0 && !ids.includes(myId);
  const change = (ids: string[], onDone?: () => void) => {
    if (losesAccess(ids)) { setPendingSelfRemoval(ids); return; }
    submit(ids, onDone);
  };
  const add = () => {
    const ids = memberIds.length === 0 && meCandidate && myId && pick !== myId ? [myId, pick] : [...memberIds, pick];
    change(ids, () => setPick(''));
  };

  return (
    <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4" aria-label="Who can see this taxpayer">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
        {members.length > 0 && <Lock className="h-4 w-4 text-gray-500" aria-hidden="true" />}
        Who can see this taxpayer
      </h2>
      {staff.isLoading ? <LoadingSpinner className="py-6" />
        : staff.isError ? <ErrorMessage message="Could not load who can see this taxpayer." onRetry={() => staff.refetch()} />
        : (
          <>
            <p className="text-sm text-gray-600">
              {members.length === 0
                ? `No list: firm administrators can see it, and so can ${rule}. Client access alone does not show a taxpayer. Each person sees only the linked companies in clients they can open.`
                : 'Only the people listed and super admins \u2014 including firm admins \u2014 can see this taxpayer. Listed people see all of its linked companies even in clients they can\u2019t otherwise open. The list replaces the firm rule for this taxpayer; it does not let them open those clients\u2019 books or change their entity setup. Keep at least one firm administrator on the list.'}
            </p>
            {members.length > 0 && (
              <ul className="divide-y rounded-md border border-gray-200">
                {members.map((m) => (
                  <li key={m.userId} className="flex items-center justify-between px-3 py-2 text-sm" data-testid="staff-row">
                    <span>
                      {m.displayName || m.email || 'Former user'}{m.email && m.displayName ? ` (${m.email})` : ''}
                      <span className="ml-2 text-xs text-gray-500">{m.firmRole ? ROLE_LABEL[m.firmRole] : 'No longer a firm member'}</span>
                    </span>
                    {canEdit && (
                      <Button variant="ghost" size="sm" disabled={save.isPending}
                        onClick={() => change(memberIds.filter((u) => u !== m.userId))}>Remove</Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canEdit ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[16rem]">
                  <label htmlFor="staff-pick" className="block text-sm font-medium text-gray-700 mb-1">Limit to staff member</label>
                  <select id="staff-pick" className={SELECT_CLASS} value={pick} onChange={(e) => setPick(e.target.value)}>
                    <option value="">{candidates.isLoading ? 'Loading…' : options.length === 0 ? 'No staff available' : 'Select a staff member'}</option>
                    {options.map((c) => (
                      <option key={c.userId} value={c.userId}>{c.displayName || c.email} ({ROLE_LABEL[c.firmRole]})</option>
                    ))}
                  </select>
                </div>
                <Button size="sm" disabled={!pick} loading={save.isPending} onClick={add}>Add</Button>
                {members.length > 0 && (
                  <Button variant="secondary" size="sm" disabled={save.isPending} onClick={() => submit([])}>Allow everyone</Button>
                )}
                {members.length === 0 && meCandidate && (
                  <p className="w-full text-xs text-gray-500">You&apos;ll be added too, so the list keeps a firm administrator who can manage it.</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500">Only a firm administrator on this list (or a super admin) can change it.</p>
            )}
            {save.isError && <p className="text-sm text-red-600" role="alert">{errMsg(save.error)}</p>}
          </>
        )}
      <ConfirmDialog open={pendingSelfRemoval !== null} variant="danger" title="Remove your own access?"
        message="You will lose access to this taxpayer. Only the people on the list and super admins will be able to see it or change the list."
        confirmLabel="Remove my access"
        onCancel={() => setPendingSelfRemoval(null)}
        onConfirm={() => { const ids = pendingSelfRemoval ?? []; setPendingSelfRemoval(null); submit(ids); }} />
    </section>
  );
}
