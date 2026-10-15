// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { isApiError } from '../../../api/client';
import { useRegisterTransactionFlag, useSetRegisterTransactionFlag } from '../../../api/hooks/useTaxEstimatorRegister';
import { useTaxEstimatorVisibility } from '../../../hooks/useTaxEstimatorVisibility';
import { Button } from '../../../components/ui/Button';

/**
 * Transaction detail card (UI-SPEC §06 footnote: "individual transactions can be marked
 * non-recurring in the register"). Renders nothing unless the caller can use the Tax
 * Estimator here (TAX_ESTIMATOR_V1 on the active tenant, firm staff, `tax_estimator`
 * read) AND the transaction's company is linked to one of the firm's taxpayers. The
 * estimate's P&L provider reads the flag: the transaction counts once and is left out of
 * the run-rate.
 */
export function NonRecurringFlagCard({ transactionId }: { transactionId: string }) {
  const { ready, showGroup } = useTaxEstimatorVisibility();
  const enabled = ready && showGroup;
  const q = useRegisterTransactionFlag(transactionId, enabled);
  const set = useSetRegisterTransactionFlag(transactionId);
  if (!enabled) return null;
  if (q.isLoading) {
    return <section aria-label="Tax Estimator" aria-busy="true" className="mt-6 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">Checking the Tax Estimator&hellip;</section>;
  }
  if (q.isError) {
    if (isApiError(q.error) && q.error.status === 404) return null; // not available to this caller here
    return (
      <section aria-label="Tax Estimator" className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between gap-3">
        <span role="alert">Could not load the Tax Estimator flag for this transaction.</span>
        <button type="button" onClick={() => q.refetch()} className="text-xs underline">Try again</button>
      </section>
    );
  }
  const d = q.data;
  if (!d || !d.linked) return null;
  const names = d.taxpayers.map((t) => t.displayName).join(', ');
  return (
    <section aria-label="Tax Estimator" className="mt-6 rounded-lg border border-gray-200 bg-white p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-gray-900">
            Tax Estimator &middot;{' '}
            {d.nonRecurring
              ? <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">Non-recurring</span>
              : <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">Recurring</span>}
          </h2>
          <p className="text-xs text-gray-600">
            {d.nonRecurring
              ? 'Counted once in the tax estimate and left out of the run-rate to year end.'
              : 'Included in the run-rate the tax estimate projects to year end.'}
            {names ? ` Linked taxpayer${d.taxpayers.length === 1 ? '' : 's'}: ${names}.` : ''}
          </p>
        </div>
        {d.canEdit && (
          <Button variant="secondary" size="sm" loading={set.isPending} onClick={() => set.mutate(!d.nonRecurring)}>
            {d.nonRecurring ? 'Mark recurring' : 'Mark non-recurring'}
          </Button>
        )}
      </div>
      {set.isError && <p role="alert" className="text-xs text-red-600">{set.error instanceof Error ? set.error.message : 'Could not save the flag.'}</p>}
    </section>
  );
}
