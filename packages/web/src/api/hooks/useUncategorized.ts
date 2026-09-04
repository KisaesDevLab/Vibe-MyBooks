// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { BankFeedItem } from '@kis-books/shared';
import { apiClient } from '../client';

const BASE = '/practice/uncategorized';

export interface SuspenseSummary {
  suspenseAccountId: string | null;
  balance: string;
  transactionCount: number;
  unpostedCount: number;
}

export interface SuspenseRow {
  transactionId: string;
  txnDate: string;
  txnType: string;
  txnNumber: string | null;
  memo: string | null;
  contactName: string | null;
  /** Check/reference number on the posted transaction. Shown in the Ref column. */
  checkNumber: number | null;
  /** Payee read off the statement's check image; the Payee column's fallback. */
  payeeNameOnCheck: string | null;
  amount: string;
  suspenseLineCount: number;
  isSplit: boolean;
  source: string | null;
  /** Receipts/documents already attached, counted server-side. */
  attachmentCount: number;
  /**
   * The polymorphic attachment key for this row — a posted transaction's own
   * txn_type, matching what the transaction detail page reads, so a file
   * added here is visible there too.
   */
  attachableType: string;
  /** The bank line this posted from, when there is one. See attachmentCount. */
  bankFeedItemId: string | null;
}

export interface SuggestionRow {
  id: string;
  targetKind: string;
  targetId: string;
  suggestedAccountId: string | null;
  suggestedLabel: string | null;
  clientNote: string | null;
  isPersonal: boolean;
  status: string;
  submittedAt: string;
  reviewedAt: string | null;
  contactName: string;
  snapshotAmount: string;
  snapshotDate: string;
  snapshotDescription: string | null;
  driftedFields: string[];
  isStale: boolean;
}

interface Paged { limit?: number; offset?: number; search?: string }

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

// Everything on this page moves money, so every mutation invalidates the
// summary AND accounts (the denormalised balances shift) on top of its own
// list. Invalidate-and-refetch is the house style — there are no optimistic
// updates anywhere in this codebase.
function useLedgerMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uncategorized'] });
      qc.invalidateQueries({ queryKey: ['bank-feed'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useSuspenseSummary() {
  return useQuery({
    queryKey: ['uncategorized', 'summary'],
    queryFn: () => apiClient<SuspenseSummary>(`${BASE}/summary`),
  });
}

/** The feed row plus the server-computed attachment count. */
export type UnpostedRow = BankFeedItem & { attachmentCount: number };

export function useUnpostedFeed(opts: Paged = {}) {
  return useQuery({
    queryKey: ['uncategorized', 'unposted', opts],
    queryFn: () => apiClient<{ items: UnpostedRow[]; total: number }>(`${BASE}/unposted${qs({ ...opts })}`),
  });
}

export function useInSuspense(opts: Paged = {}) {
  return useQuery({
    queryKey: ['uncategorized', 'in-suspense', opts],
    queryFn: () => apiClient<{ rows: SuspenseRow[]; total: number; suspenseAccountId: string | null }>(
      `${BASE}/in-suspense${qs({ ...opts })}`,
    ),
  });
}

export function useSuggestions(opts: Paged & { status?: string; unread?: boolean } = {}) {
  return useQuery({
    queryKey: ['uncategorized', 'suggestions', opts],
    queryFn: () => apiClient<{ rows: SuggestionRow[]; total: number }>(
      `${BASE}/suggestions${qs({ ...opts })}`,
    ),
  });
}

export interface PostToSuspenseResult {
  suspenseAccountId: string;
  posted: number;
  skipped: Array<{ id: string; reason: string }>;
  failures: Array<{ id: string; error: string }>;
}

export function usePostToSuspense() {
  return useLedgerMutation((feedItemIds: string[]) =>
    apiClient<PostToSuspenseResult>(
      `${BASE}/post-to-suspense`, { method: 'POST', body: JSON.stringify({ feedItemIds }) },
    ));
}

export function useClearSuspense() {
  return useLedgerMutation((input: { transactionIds: string[]; accountId: string }) =>
    apiClient<{ updated: number; skipped: Array<{ id: string; reason: string }> }>(
      `${BASE}/clear`, { method: 'POST', body: JSON.stringify(input) },
    ));
}

export function useApproveSuggestions() {
  return useLedgerMutation((input: { ids: string[]; overrideAccountId?: string; confirmDrift?: boolean }) =>
    apiClient<{ approved: string[]; failed: Array<{ id: string; reason: string }> }>(
      `${BASE}/suggestions/approve`, { method: 'POST', body: JSON.stringify(input) },
    ));
}

export function useRejectSuggestions() {
  return useLedgerMutation((input: { ids: string[]; reason: string }) =>
    apiClient<{ rejected: string[] }>(
      `${BASE}/suggestions/reject`, { method: 'POST', body: JSON.stringify(input) },
    ));
}

export function useMarkSuggestionsReviewed() {
  return useLedgerMutation((ids?: string[]) =>
    apiClient<{ marked: number }>(
      `${BASE}/suggestions/mark-reviewed`, { method: 'POST', body: JSON.stringify({ ids }) },
    ));
}
