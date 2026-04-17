// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { WriteCheckInput, PrintCheckInput, CheckSettings, PrintBatchResult, Transaction } from '@kis-books/shared';
import { apiClient } from '../client';

export function useWriteCheck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WriteCheckInput) =>
      apiClient<{ transaction: Transaction }>('/checks', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['checks'] });
      queryClient.invalidateQueries({ queryKey: ['print-queue'] });
    },
  });
}

export function useChecks(filters?: { bankAccountId?: string; printStatus?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (filters?.bankAccountId) params.set('bank_account_id', filters.bankAccountId);
  if (filters?.printStatus) params.set('print_status', filters.printStatus);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));

  const qs = params.toString();
  return useQuery({
    queryKey: ['checks', filters],
    queryFn: () => apiClient<{ data: Transaction[]; total: number }>(`/checks${qs ? `?${qs}` : ''}`),
  });
}

export function usePrintQueue(bankAccountId?: string) {
  const params = new URLSearchParams();
  if (bankAccountId) params.set('bank_account_id', bankAccountId);

  const qs = params.toString();
  return useQuery({
    queryKey: ['print-queue', bankAccountId],
    queryFn: () => apiClient<{ data: Array<{
      id: string;
      txnDate: string;
      payeeNameOnCheck: string;
      amount: string;
      printedMemo: string | null;
    }>; total: number }>(`/checks/print-queue${qs ? `?${qs}` : ''}`),
    enabled: !!bankAccountId,
  });
}

export function usePrintChecks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PrintCheckInput) =>
      apiClient<PrintBatchResult>('/checks/print', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checks'] });
      queryClient.invalidateQueries({ queryKey: ['print-queue'] });
      queryClient.invalidateQueries({ queryKey: ['check-settings'] });
    },
  });
}

export function useCheckSettings() {
  return useQuery({
    queryKey: ['check-settings'],
    queryFn: () => apiClient<{ settings: CheckSettings }>('/checks/settings'),
  });
}

export function useUpdateCheckSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CheckSettings>) =>
      apiClient<{ settings: CheckSettings }>('/checks/settings', {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['check-settings'] });
    },
  });
}
