// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/forms/DatePicker';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ArrowLeft, ArrowRight, XCircle } from 'lucide-react';

// ─── Types (mirror duplicate-detection.service DuplicatePair) ───────

interface DuplicateTxn {
  id: string;
  txnType: string;
  txnNumber: string | null;
  txnDate: string;
  payee: string | null;
  total: string;
  memo: string | null;
}

interface DuplicatePair {
  a: DuplicateTxn;
  b: DuplicateTxn;
  daysApart: number;
}

interface ScanResponse {
  pairs: DuplicatePair[];
  count: number;
  limit: number;
  startDate: string;
  endDate: string;
}

// ─── Date range ─────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return isoDate(d);
}

// Server default is the last 3 months; presets widen it. "All time" uses a
// far-past start because the scan requires a bounded range.
const PRESETS: Array<{ label: string; start: () => string }> = [
  { label: 'Last 3 months', start: () => monthsAgo(3) },
  { label: 'Last 12 months', start: () => monthsAgo(12) },
  { label: 'This year', start: () => `${new Date().getFullYear()}-01-01` },
  { label: 'All time', start: () => '2000-01-01' },
];

// ─── API Hooks ──────────────────────────────────────────────────────

function useDuplicates(startDate: string, endDate: string) {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && /^\d{4}-\d{2}-\d{2}$/.test(endDate) && startDate <= endDate;
  return useQuery({
    queryKey: ['duplicates', startDate, endDate],
    queryFn: () =>
      apiClient<ScanResponse>(`/duplicates?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`),
    enabled: valid,
  });
}

function useMergeDuplicate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { keepId: string; voidId: string }) =>
      apiClient<void>('/duplicates/merge', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['duplicates'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

function useDismissDuplicate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ idA, idB }: { idA: string; idB: string }) =>
      apiClient<void>(`/duplicates/${idA}/dismiss/${idB}`, {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['duplicates'] }),
  });
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatMoney(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return '$0.00';
  return `$${Math.abs(num).toFixed(2)}`;
}

function TxnCard({ txn, side }: { txn: DuplicateTxn; side: 'left' | 'right' }) {
  return (
    <div className={`flex-1 p-4 rounded-lg border ${side === 'left' ? 'border-blue-200 bg-blue-50/50' : 'border-amber-200 bg-amber-50/50'}`}>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-gray-500">Date</dt>
          <dd className="font-medium text-gray-900">{txn.txnDate}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Type</dt>
          <dd className="font-medium text-gray-900 capitalize">
            {txn.txnType.replace(/_/g, ' ')}{txn.txnNumber ? ` #${txn.txnNumber}` : ''}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Payee</dt>
          <dd className="font-medium text-gray-900">{txn.payee || '--'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Amount</dt>
          <dd className="font-mono font-medium text-gray-900">{formatMoney(txn.total)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-500">Memo</dt>
          <dd className="font-medium text-gray-900 truncate max-w-[180px]" title={txn.memo || undefined}>{txn.memo || '--'}</dd>
        </div>
      </dl>
    </div>
  );
}

// ─── Page Component ─────────────────────────────────────────────────

export function DuplicateReviewPage() {
  const [startDate, setStartDate] = useState(() => monthsAgo(3));
  const [endDate, setEndDate] = useState(() => isoDate(new Date()));
  const { data, isLoading, error, refetch } = useDuplicates(startDate, endDate);
  const merge = useMergeDuplicate();
  const dismiss = useDismissDuplicate();

  const pairs = data?.pairs ?? [];
  const capped = !!data && data.count >= data.limit;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Duplicate Review</h1>
          <p className="text-sm text-gray-500 mt-1">
            {isLoading ? 'Scanning…' : `${pairs.length} potential duplicate${pairs.length !== 1 ? 's' : ''} found`}
            {capped && ` (showing the first ${data.limit} — narrow the dates to see the rest)`}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <DatePicker label="From" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
          <DatePicker label="To" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
          <div className="flex gap-1 pb-0.5">
            {PRESETS.map((p) => (
              <Button key={p.label} size="sm" variant="ghost" onClick={() => { setStartDate(p.start()); setEndDate(isoDate(new Date())); }}>
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Pairs with the same amount and payee dated within 3 days of each other. Journal entries and transfers are skipped.
        Merging voids one transaction and keeps the other; "Not a duplicate" hides the pair for good.
      </p>

      {isLoading ? (
        <LoadingSpinner className="py-12" />
      ) : error ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <p className="text-red-600 mb-4">Failed to load duplicates.</p>
          <Button variant="secondary" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : pairs.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No potential duplicates found between {startDate} and {endDate}. Widen the dates to scan further back.
        </div>
      ) : (
        <div className="space-y-4">
          {pairs.map((pair) => (
            <div
              key={`${pair.a.id}-${pair.b.id}`}
              className="bg-white rounded-lg border border-gray-200 shadow-sm p-5"
            >
              {/* Side-by-side comparison */}
              <div className="flex gap-4 mb-4">
                <TxnCard txn={pair.a} side="left" />
                <div className="flex items-center">
                  <span className="text-xs text-gray-500 font-medium bg-gray-100 rounded-full px-2 py-1 whitespace-nowrap">
                    {pair.daysApart === 0 ? 'Same day' : `${pair.daysApart} day${pair.daysApart === 1 ? '' : 's'} apart`}
                  </span>
                </div>
                <TxnCard txn={pair.b} side="right" />
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-center gap-3 pt-3 border-t border-gray-100">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => merge.mutate({ keepId: pair.a.id, voidId: pair.b.id })}
                  loading={merge.isPending}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Keep Left / Void Right
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => merge.mutate({ keepId: pair.b.id, voidId: pair.a.id })}
                  loading={merge.isPending}
                >
                  Keep Right / Void Left
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismiss.mutate({ idA: pair.a.id, idB: pair.b.id })}
                  loading={dismiss.isPending}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Not a Duplicate
                </Button>
              </div>
              {(merge.error || dismiss.error) && (
                <p className="mt-2 text-center text-xs text-red-700">
                  {((merge.error ?? dismiss.error) as Error).message || 'That did not work. Try again.'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
