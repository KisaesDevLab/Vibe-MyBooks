// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ArrowLeft, ArrowRight, XCircle } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

interface DuplicateTxn {
  id: string;
  txnDate: string;
  txnType: string;
  payee: string | null;
  total: string;
  memo: string | null;
}

interface DuplicatePair {
  a: DuplicateTxn;
  b: DuplicateTxn;
  score: number;
}

// ─── API Hooks ──────────────────────────────────────────────────────

function useDuplicates() {
  return useQuery({
    queryKey: ['duplicates'],
    queryFn: () => apiClient<{ data: DuplicatePair[] }>('/duplicates'),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['duplicates'] }),
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
          <dd className="font-medium text-gray-900 capitalize">{txn.txnType.replace(/_/g, ' ')}</dd>
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
          <dd className="font-medium text-gray-900 truncate max-w-[180px]">{txn.memo || '--'}</dd>
        </div>
      </dl>
    </div>
  );
}

// ─── Page Component ─────────────────────────────────────────────────

export function DuplicateReviewPage() {
  const { data, isLoading, error } = useDuplicates();
  const merge = useMergeDuplicate();
  const dismiss = useDismissDuplicate();

  if (isLoading) return <LoadingSpinner className="py-12" />;

  if (error) {
    return (
      <div className="bg-white rounded-lg border p-12 text-center">
        <p className="text-red-600 mb-4">Failed to load duplicates.</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const pairs = data?.data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Duplicate Review</h1>
          <p className="text-sm text-gray-500 mt-1">
            {pairs.length} potential duplicate{pairs.length !== 1 ? 's' : ''} found
          </p>
        </div>
      </div>

      {pairs.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No potential duplicates found. Your books are looking clean!
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
                  <span className="text-xs text-gray-400 font-medium bg-gray-100 rounded-full px-2 py-1">
                    {Math.round(pair.score * 100)}%
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
