// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { Lock } from 'lucide-react';
import {
  useTaxpayerStaff, useTaxpayerStaffCandidates, useReplaceTaxpayerStaff,
} from '../../../api/hooks/useTaxEstimatorTaxpayers';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { SELECT_CLASS } from './labels';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Request failed');
const ROLE_LABEL: Record<string, string> = { firm_staff: 'Staff', firm_readonly: 'Read-only', firm_admin: 'Admin' };

/**
 * D17 / D18 "Who can see this taxpayer". Firm admins edit the staff list; everyone else sees
 * it read-only. Empty list = the firm rule (D17); a non-empty list REPLACES it (D18): only the
 * listed people (and firm administrators) see the taxpayer, with all of its linked companies.
 * The server enforces every rule (firm-scope.service visibleTaxpayerFilter / scopeForTaxpayer);
 * this card only explains it and edits the list.
 */
export function TaxpayerAccessCard({ taxpayerId }: { taxpayerId: string }) {
  const staff = useTaxpayerStaff(taxpayerId);
  const canEdit = staff.data?.canEdit === true;
  const candidates = useTaxpayerStaffCandidates(taxpayerId, canEdit);
  const save = useReplaceTaxpayerStaff(taxpayerId);
  const [pick, setPick] = useState('');

  const members = staff.data?.members ?? [];
  const memberIds = members.map((m) => m.userId);
  const options = (candidates.data?.data ?? []).filter((c) => !memberIds.includes(c.userId));
  const rule = staff.data?.restrictToLinkedTenants
    ? 'staff who can reach at least one client company this taxpayer is linked to'
    : 'all firm staff with Tax Estimator access';

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
                ? `Everyone allowed by the firm rule can see it: ${rule}. Firm administrators always can. Each person sees only the linked companies in clients they can open.`
                : 'Only these people (and firm administrators) can see this taxpayer, and they see all of its linked companies even in clients they can\u2019t otherwise open. The list replaces the firm rule for this taxpayer; it does not let them open those clients\u2019 books or change their entity setup.'}
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
                        onClick={() => save.mutate(memberIds.filter((u) => u !== m.userId))}>Remove</Button>
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
                <Button size="sm" disabled={!pick} loading={save.isPending}
                  onClick={() => save.mutate([...memberIds, pick], { onSuccess: () => setPick('') })}>Add</Button>
                {members.length > 0 && (
                  <Button variant="secondary" size="sm" disabled={save.isPending} onClick={() => save.mutate([])}>Allow everyone</Button>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500">Only a firm administrator can change this list.</p>
            )}
            {save.isError && <p className="text-sm text-red-600" role="alert">{errMsg(save.error)}</p>}
          </>
        )}
    </section>
  );
}
