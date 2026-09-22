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
  /** Linked payee (transactions.contact_id). The row's Payee picker edits it. */
  contactId: string | null;
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
  /** Present when requested with includeSuggestions: the live (pending)
   *  suggestion on this row, from a portal contact or a team member. */
  pendingSuggestion?: PendingSuggestionView | null;
}

export interface PendingSuggestionView {
  id: string;
  label: string | null;
  note: string | null;
  isPersonal: boolean;
  submittedBy: 'portal_contact' | 'team_member';
  submittedByUserId: string | null;
  submittedByName: string;
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
  /** Display name of whoever answered — a portal contact or a team member. */
  contactName: string;
  submittedBy?: 'portal_contact' | 'team_member';
  submittedByUserId?: string | null;
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

export function useInSuspense(opts: Paged & { includeSuggestions?: boolean } = {}) {
  return useQuery({
    queryKey: ['uncategorized', 'in-suspense', opts],
    queryFn: () => apiClient<{ rows: SuspenseRow[]; total: number; suspenseAccountId: string | null }>(
      `${BASE}/in-suspense${qs({ ...opts })}`,
    ),
  });
}

export function useSuggestions(opts: Paged & { status?: string; unread?: boolean } = {}, enabled = true) {
  return useQuery({
    enabled,
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

// ── Ask the client for help ─────────────────────────────────────
// A notice, not a ledger action, so it does NOT use useLedgerMutation: nothing
// on the page changes when it goes out except the "last asked" stamp.

export interface HelpRecipient {
  contactId: string;
  name: string;
  email: string;
  phone: string | null;
  emailSuppressed: boolean;
  smsSuppressed: boolean;
  lastSeenAt: string | null;
  lastAskedAt: string | null;
}

export interface HelpRecipientsView {
  portalEnabled: boolean;
  queueCount: number;
  smsAvailable: boolean;
  smsUnavailableReason: string | null;
  companyName: string;
  contacts: HelpRecipient[];
}

export type HelpChannel = 'email' | 'sms';
export type HelpOutcome = 'sent' | 'suppressed' | 'no_phone' | 'sms_disabled' | 'error';

export interface HelpSendResult {
  queueCount: number;
  results: Array<{
    contactId: string;
    name: string;
    outcomes: Array<{ channel: HelpChannel; outcome: HelpOutcome; error?: string }>;
  }>;
  notEligible: string[];
}

export function useHelpRecipients(enabled = true) {
  return useQuery({
    queryKey: ['uncategorized', 'help-recipients'],
    queryFn: () => apiClient<HelpRecipientsView>(`${BASE}/help-request/recipients`),
    enabled,
  });
}

export function useSendHelpRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { contactIds: string[]; channels: HelpChannel[]; note?: string; confirmEmpty?: boolean }) =>
      apiClient<HelpSendResult>(`${BASE}/help-request`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uncategorized', 'help-recipients'] });
    },
  });
}

export function useMarkSuggestionsReviewed() {
  return useLedgerMutation((ids?: string[]) =>
    apiClient<{ marked: number }>(
      `${BASE}/suggestions/mark-reviewed`, { method: 'POST', body: JSON.stringify({ ids }) },
    ));
}

// ── Team members (Banking → Uncategorized) ──────────────────────
// Which audience the caller is: a reviewer (firm staff of the managing firm,
// or the owner of self-managed books) or suggest-only. The web uses this to
// pick the page and to show the owner's Suggested tab.
export interface UncategorizedMode {
  mode: 'review' | 'suggest';
  managedByFirm: boolean;
  firmName?: string;
  canReview: boolean;
}

export function useUncategorizedMode(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['uncategorized', 'mode'],
    queryFn: () => apiClient<UncategorizedMode>(`${BASE}/mode`),
    retry: false,
  });
}

export interface TeamCategory { id: string; label: string; group: string; hint: string | null }

export function useTeamCategories() {
  return useQuery({
    queryKey: ['uncategorized', 'team-categories'],
    queryFn: () => apiClient<{ categories: TeamCategory[] }>(`${BASE}/team/categories`),
    staleTime: 60 * 1000,
  });
}

export interface TeamSuggestInput {
  items: Array<{ targetId: string; categoryId: string; note?: string }>;
}
export interface TeamSuggestResult {
  accepted: string[];
  failed: Array<{ targetId: string; reason: string }>;
}

// Suggesting never moves money, so only the uncategorized queries refresh.
export function useSubmitTeamSuggestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TeamSuggestInput) =>
      apiClient<TeamSuggestResult>(`${BASE}/team/suggest`, { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['uncategorized'] }),
  });
}

export function useWithdrawTeamSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (suggestionId: string) =>
      apiClient<{ withdrawn: boolean }>(`${BASE}/team/suggest/${suggestionId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['uncategorized'] }),
  });
}

// ── Per-row payee edits ──────────────────────────────────────────────────
//
// A payee is header-level: changing it moves no money and never removes a
// row from either list, so both writes below leave `accounts` alone and only
// refresh the lists that display the name.

export interface SetPayeeResult {
  updated: number;
  skipped: Array<{ id: string; reason: string }>;
}

/**
 * Posted transaction (In suspense tab): the same bulk-update endpoint the
 * transactions list uses for its Payee edit, with one id. `null` clears it.
 */
export function useSetSuspensePayee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { transactionId: string; contactId: string | null }) =>
      apiClient<SetPayeeResult>('/transactions/bulk-update', {
        method: 'POST',
        body: JSON.stringify({ txnIds: [input.transactionId], setPayeeContactId: input.contactId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uncategorized'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/**
 * Unposted bank line (Not posted tab): sets the feed item's contact — the
 * same field the Bank Feeds editor writes — without staging or posting it,
 * so the line stays `pending` and stays on this list. `null` clears it.
 */
export function useSetFeedItemPayee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { feedItemId: string; contactId: string | null }) =>
      apiClient<{ item: BankFeedItem }>(`/banking/feed/${input.feedItemId}`, {
        method: 'PUT',
        body: JSON.stringify({ contactId: input.contactId }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['uncategorized'] });
      qc.invalidateQueries({ queryKey: ['bank-feed'] });
    },
  });
}
