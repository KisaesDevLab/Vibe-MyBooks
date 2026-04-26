// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface ManualQueueRow {
  bankFeedItemId: string;
  bankConnectionId: string;
  feedDate: string;
  description: string;
  amount: string;
  stateId: string | null;
  reason: 'orphan' | 'no_suggestion';
}

interface Input {
  companyId: string | null;
  periodStart: string;
  periodEnd: string;
}

const KEY = (input: Input) =>
  ['practice', 'classification', 'manual-queue', input.companyId, input.periodStart, input.periodEnd] as const;

export function useManualQueue(input: Input) {
  const qs = new URLSearchParams();
  if (input.companyId) qs.set('companyId', input.companyId);
  qs.set('periodStart', input.periodStart);
  qs.set('periodEnd', input.periodEnd);
  return useQuery({
    queryKey: KEY(input),
    queryFn: () =>
      apiClient<{ rows: ManualQueueRow[] }>(
        `/practice/classification/manual-queue?${qs.toString()}`,
      ),
    staleTime: 30 * 1000,
  });
}
