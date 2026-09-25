// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccrualKind, AccrualMethod } from '@kis-books/shared';
import { apiClient } from '../client';

// Close Review → Accruals (ACCRUALS_V1).

export interface AccrualScheduleRow {
  id: string;
  kind: AccrualKind;
  description: string;
  status: 'active' | 'cancelled' | 'completed';
  total_amount: string;
  start_date: string;
  months: number;
  method: AccrualMethod;
  balance_account_name: string | null;
  recognition_account_name: string | null;
  posted_amount: string;
  posted_count: number;
  draft_count: number;
}

export interface AccrualEntryRow {
  id: string;
  schedule_id: string;
  description: string;
  kind: AccrualKind;
  period_start: string;
  post_period: string;
  amount: string;
  is_catch_up: boolean;
  status: 'draft' | 'posted';
  transaction_id: string | null;
  balance_account_name: string | null;
  recognition_account_name: string | null;
}

export interface AccrualCandidates {
  unscheduled: Array<{ transaction_id: string; txn_date: string; memo: string | null; payee: string | null; account_id: string; account_name: string; debit: string; credit: string; suggested_kind: AccrualKind }>;
  possiblePrepaids: Array<{ transaction_id: string; txn_date: string; memo: string | null; total: string; payee: string | null; account_id: string; account_name: string }>;
  missingRecurring: Array<{ contact_id: string; payee: string; months: number; avg_amount: string }>;
}

export interface TieOutRow { accountId: string; accountName: string; kind: AccrualKind; ledgerBalance: string; scheduleBalance: string; difference: string }

export interface ScheduleInputClient {
  companyId?: string | null;
  kind: AccrualKind;
  description: string;
  sourceTransactionId?: string | null;
  balanceAccountId: string;
  recognitionAccountId: string;
  totalAmount: string;
  startDate: string;
  months: number;
  method: AccrualMethod;
  postFrom?: string | null;
}

const qs = (o: Record<string, string | null | undefined>) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v) as Array<[string, string]>).toString();
const KEY = ['practice', 'accruals'] as const;

export function useAccrualSchedules(companyId: string | null) {
  return useQuery({
    queryKey: [...KEY, 'schedules', companyId],
    queryFn: () => apiClient<{ schedules: AccrualScheduleRow[] }>(`/practice/accruals/schedules?${qs({ companyId })}`),
  });
}

export function useAccrualEntries(companyId: string | null, periodStart: string) {
  return useQuery({
    queryKey: [...KEY, 'entries', companyId, periodStart],
    queryFn: () => apiClient<{ entries: AccrualEntryRow[] }>(`/practice/accruals/entries?${qs({ companyId, periodStart })}`),
  });
}

export function useAccrualCandidates(companyId: string | null, periodStart: string, periodEnd: string) {
  return useQuery({
    queryKey: [...KEY, 'candidates', companyId, periodStart],
    queryFn: () => apiClient<AccrualCandidates>(`/practice/accruals/candidates?${qs({ companyId, periodStart, periodEnd })}`),
  });
}

export function useAccrualTieOut(companyId: string | null, periodEnd: string) {
  return useQuery({
    queryKey: [...KEY, 'tie-out', companyId, periodEnd],
    queryFn: () => apiClient<{ rows: TieOutRow[] }>(`/practice/accruals/tie-out?${qs({ companyId, periodEnd })}`),
  });
}

function useAccrualMutation<TIn, TOut>(fn: (input: TIn) => Promise<TOut>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    // Settled, not success: a Post all that fails part-way (a locked month)
    // has still posted the earlier entries, and the screen must show that.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['practice', 'checks', 'checklist'] });
    },
  });
}

export const useCreateAccrualSchedule = () => useAccrualMutation((input: ScheduleInputClient) =>
  apiClient<{ schedule: { id: string } }>('/practice/accruals/schedules', { method: 'POST', body: JSON.stringify(input) }));
export const useCancelAccrualSchedule = () => useAccrualMutation((id: string) =>
  apiClient(`/practice/accruals/schedules/${id}/cancel`, { method: 'POST' }));
export const useDeleteAccrualSchedule = () => useAccrualMutation((id: string) =>
  apiClient(`/practice/accruals/schedules/${id}`, { method: 'DELETE' }));
export const usePostAccrualEntry = () => useAccrualMutation((id: string) =>
  apiClient<{ transactionId: string | null }>(`/practice/accruals/entries/${id}/post`, { method: 'POST' }));
export const useUnpostAccrualEntry = () => useAccrualMutation((id: string) =>
  apiClient(`/practice/accruals/entries/${id}/unpost`, { method: 'POST' }));
export const usePostAllAccruals = () => useAccrualMutation((input: { companyId: string | null; periodStart: string }) =>
  apiClient<{ posted: number }>('/practice/accruals/post-all', { method: 'POST', body: JSON.stringify(input) }));
export const useImportAccruals = () => useAccrualMutation((input: { companyId: string | null; csv: string }) =>
  apiClient<{ created: number; errors: Array<{ row: number; error: string }> }>('/practice/accruals/import', { method: 'POST', body: JSON.stringify(input) }));
