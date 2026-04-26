// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { BucketRow, ClassificationBucket } from '@kis-books/shared';
import { useApprove, useApproveAll, useBucket, useReclassify } from '../../../../api/hooks/useClassificationState';
import { useReviewKeyboardShortcuts } from '../useReviewKeyboardShortcuts';
import { BulkActionBar } from '../BulkActionBar';
import { AskClientButton } from '../AskClientButton';
import { AttachReceiptButton } from './AttachReceiptButton';
import { ReceiptComparisonPanel } from './ReceiptComparisonPanel';
import type { ClosePeriod } from '../ClosePeriodSelector';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { BUCKET_LABELS } from '../BucketSummaryRow';

export interface BucketTableProps {
  bucket: ClassificationBucket;
  companyId: string | null;
  period: ClosePeriod;
  emptyState?: React.ReactNode;
  /**
   * Optional custom renderer for the data-specific columns
   * between the checkbox + description and the action buttons.
   * Falls back to the default (account, vendor, confidence,
   * reasoning summary) when omitted.
   */
  renderRow?: (row: BucketRow) => React.ReactNode;
}

// Shared table shell for the four bucket views. Each bucket can
// supply a custom renderer for its middle columns; action column
// (approve + reclassify + ask-client) is shared.
export function BucketTable({ bucket, companyId, period, emptyState, renderRow }: BucketTableProps) {
  const query = useBucket({ bucket, companyId, periodStart: period.periodStart, periodEnd: period.periodEnd, limit: 100 });
  const approve = useApprove();
  const approveAll = useApproveAll();
  const reclassify = useReclassify();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusedStateId, setFocusedStateId] = useState<string | null>(null);
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const rows = query.data?.rows ?? [];
  const totalCount = rows.length;
  const allSelected = totalCount > 0 && selected.size === totalCount;

  // Reset selection when bucket/period changes.
  useEffect(() => {
    setSelected(new Set());
    setFocusedStateId(null);
  }, [bucket, companyId, period.periodStart]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.stateId)));
    }
  };

  const handleApproveSelected = () => {
    if (selected.size === 0) return;
    approve.mutate(Array.from(selected), {
      onSettled: () => setSelected(new Set()),
    });
  };

  const runApproveAll = async (): Promise<void> => {
    await approveAll.mutateAsync({
      bucket,
      companyId,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      confirm: bucket === 'auto_high' ? true : undefined,
    });
  };

  // Confirmation gate: auto_high posts every row in the bucket as
  // a real ledger transaction. Both the toolbar button and the
  // keyboard shortcut share this gate so neither path can slip
  // past the dialog.
  const handleApproveAll = (): Promise<void> | void => {
    if (bucket === 'auto_high') {
      setConfirmAllOpen(true);
      return;
    }
    return runApproveAll();
  };

  const handleToggleFocused = () => {
    if (focusedStateId) toggle(focusedStateId);
  };
  const handleApproveFocused = () => {
    if (focusedStateId) {
      approve.mutate([focusedStateId], {
        onSettled: () => {
          setSelected((s) => {
            const next = new Set(s);
            next.delete(focusedStateId);
            return next;
          });
        },
      });
    }
  };

  useReviewKeyboardShortcuts(containerRef, {
    onToggleSelect: handleToggleFocused,
    onApprove: handleApproveFocused,
    onApproveAll: () => {
      const r = handleApproveAll();
      if (r) void r;
    },
  });

  const formatter = useMemo(
    () => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    [],
  );

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
        {emptyState ?? 'No items in this bucket for the selected period.'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" ref={containerRef} tabIndex={0} aria-label={`${bucket} bucket list`}>
      <BulkActionBar
        bucket={bucket}
        selectedCount={selected.size}
        totalCount={totalCount}
        allSelected={allSelected}
        disabled={approve.isPending || approveAll.isPending}
        onToggleAll={toggleAll}
        onApproveSelected={handleApproveSelected}
        onApproveAll={handleApproveAll}
        onClearSelection={() => setSelected(new Set())}
      />
      <ConfirmDialog
        open={confirmAllOpen}
        title={`Approve all ${BUCKET_LABELS[bucket]} items?`}
        message="Every item in this bucket will be posted as a transaction using its suggested account and vendor. This action cannot be undone in bulk — individual transactions must be voided one by one."
        confirmLabel="Approve all"
        variant="primary"
        onConfirm={() => {
          setConfirmAllOpen(false);
          void runApproveAll();
        }}
        onCancel={() => setConfirmAllOpen(false)}
      />
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
              <th className="px-3 py-2 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Details</th>
              <th className="px-3 py-2 w-48">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const isSelected = selected.has(row.stateId);
              const isFocused = focusedStateId === row.stateId;
              return (
                <tr
                  key={row.stateId}
                  className={`${isSelected ? 'bg-indigo-50' : ''} ${isFocused ? 'ring-2 ring-inset ring-indigo-400' : ''}`}
                  onMouseEnter={() => setFocusedStateId(row.stateId)}
                  onFocus={() => setFocusedStateId(row.stateId)}
                  tabIndex={0}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(row.stateId)}
                      aria-label={`Select ${row.description}`}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{row.feedDate}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-gray-900">{row.description}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-900">
                    {formatter.format(parseFloat(row.amount))}
                  </td>
                  <td className="px-3 py-2">
                    {renderRow
                      ? renderRow(row)
                      : (
                        <DefaultDetails row={row} />
                      )}
                    {row.receiptOcr && (
                      <ReceiptComparisonPanel
                        ocr={row.receiptOcr}
                        bankAmount={Math.abs(parseFloat(row.amount))}
                        bankDescription={row.description}
                        bankDate={row.feedDate}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          approve.mutate([row.stateId]);
                        }}
                        disabled={!row.suggestedAccountId || approve.isPending}
                        title={row.suggestedAccountId ? 'Approve and post transaction' : 'Pick an account first'}
                        className="inline-flex items-center rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      {bucket !== 'needs_review' && (
                        <button
                          type="button"
                          onClick={() => reclassify.mutate({ stateId: row.stateId, bucket: 'needs_review' })}
                          disabled={reclassify.isPending}
                          title="Move to Needs Review"
                          className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Send back
                        </button>
                      )}
                      {!row.receiptOcr && <AttachReceiptButton bankFeedItemId={row.bankFeedItemId} />}
                      <AskClientButton stateId={row.stateId} description={row.description} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DefaultDetails({ row }: { row: BucketRow }) {
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {row.suggestedAccountName && (
        <span className="text-gray-800">Account: {row.suggestedAccountName}</span>
      )}
      {row.suggestedVendorName && (
        <span className="text-gray-600">Vendor: {row.suggestedVendorName}</span>
      )}
      {row.matchedRuleName && (
        <span className="text-gray-600">Rule: {row.matchedRuleName}</span>
      )}
      <span className="text-gray-500">
        Confidence: <span className="font-mono">{row.confidenceScore.toFixed(2)}</span>
      </span>
    </div>
  );
}
