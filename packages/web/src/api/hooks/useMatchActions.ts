// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

interface ApplyMatchResponse {
  appliedTransactionId: string;
  kind: string;
  appliedAmount: string;
  partial: boolean;
}

// "Apply match" — posts the appropriate ledger transaction
// (payment, bill payment, transfer, recurring materialization, or
// just links a JE), links the bank-feed item, stamps the
// classification state. Invalidates every practice/classification
// query so the bucket counts and per-bucket lists refresh.
export function useApplyMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { stateId: string; candidateIndex: number }) =>
      apiClient<ApplyMatchResponse>(
        `/practice/classification/${input.stateId}/apply`,
        {
          method: 'POST',
          body: JSON.stringify({ candidateIndex: input.candidateIndex }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practice', 'classification'] });
    },
  });
}

// "Not a match" — drops one candidate. Re-runs bucket assignment
// server-side; the row may move out of Bucket 1 if the dropped
// candidate was the only one above threshold.
export function useNotAMatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { stateId: string; candidateIndex: number }) =>
      apiClient<{ remaining: number }>(
        `/practice/classification/${input.stateId}/not-a-match`,
        {
          method: 'POST',
          body: JSON.stringify({ candidateIndex: input.candidateIndex }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practice', 'classification'] });
    },
  });
}

// "Re-run matcher" — used after a bookkeeper creates an invoice
// or bill they expect to find a pending feed item to match.
export function useRematch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stateId: string) =>
      apiClient<{ candidateCount: number }>(
        `/practice/classification/${stateId}/rematch`,
        { method: 'POST' },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practice', 'classification'] });
    },
  });
}
