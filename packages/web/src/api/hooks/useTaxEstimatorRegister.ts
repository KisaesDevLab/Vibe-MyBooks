// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tax Estimator register surface (R7-07 #2): the per-transaction non-recurring flag on
// the transaction detail and the register badge. The server reads the ACTIVE tenant and
// company (X-Company-Id from apiClient) and the active tenant's managing firm — no
// X-Firm-Id here. A 404 means "not available to this caller" and is an answer, not a
// blip, so nothing retries.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RegisterCompanyFlagsDTO, RegisterTransactionFlagDTO } from '@kis-books/shared';
import { apiClient } from '../client';

export const TE_REGISTER_KEY = 'tax-estimator-register';

export function useRegisterTransactionFlag(transactionId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [TE_REGISTER_KEY, 'transaction', transactionId],
    queryFn: async () => (await apiClient<{ data: RegisterTransactionFlagDTO }>(`/tax-estimator/register/transactions/${transactionId}`)).data,
    enabled: enabled && !!transactionId,
    retry: false,
    staleTime: 30_000,
  });
}

export function useSetRegisterTransactionFlag(transactionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nonRecurring: boolean) =>
      (await apiClient<{ data: RegisterTransactionFlagDTO }>(`/tax-estimator/register/transactions/${transactionId}`, {
        method: 'PUT', body: JSON.stringify({ nonRecurring }),
      })).data,
    onSuccess: (data) => {
      qc.setQueryData([TE_REGISTER_KEY, 'transaction', transactionId], data);
      void qc.invalidateQueries({ queryKey: [TE_REGISTER_KEY, 'company-flags'] });
    },
  });
}

/** Flagged transactions of the active company (register badges). */
export function useRegisterCompanyFlags(enabled: boolean) {
  return useQuery({
    queryKey: [TE_REGISTER_KEY, 'company-flags', typeof localStorage === 'undefined' ? null : localStorage.getItem('activeCompanyId')],
    queryFn: async () => (await apiClient<{ data: RegisterCompanyFlagsDTO }>('/tax-estimator/register/flags')).data,
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}
