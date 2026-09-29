// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

// Close Review → Bank feed hooks. Gated by AI_BUCKET_WORKFLOW_V1 at the
// route level (PracticeLayout) and the API level (/api/v1/practice/
// classification returns 404 when the flag is off for the tenant).

export interface SummaryInput {
  companyId: string | null;
  periodStart: string;
  periodEnd: string;
}

// ── Bank feed review (Close Review reviewer pass) ──────────────────
// The period's already-categorized / matched / excluded bank-feed items,
// how each got its category, and the reviewer's "Looks right" mark.

export type FeedReviewMethod = 'rule' | 'ai' | 'history' | 'check_image' | 'manual' | 'matched' | 'excluded';
export type FeedReviewStatus = 'todo' | 'reviewed' | 'all';
export const FEED_REVIEW_SORT_KEYS = ['feedDate', 'description', 'payee', 'category', 'method', 'amount', 'reviewed'] as const;
export type FeedReviewSortKey = (typeof FEED_REVIEW_SORT_KEYS)[number];

export interface FeedReviewSummary {
  periodTotal: number;
  periodOpen: number;
  doneTotal: number;
  reviewed: number;
  byMethod: Record<FeedReviewMethod, { total: number; reviewed: number }>;
  hasBankFeed: boolean;
  otherMonthsOpen: Array<{ month: string; count: number }>;
}

export interface FeedReviewRow {
  feedItemId: string;
  feedDate: string;
  description: string | null;
  amount: string;
  status: string;
  method: FeedReviewMethod;
  bankAccountName: string | null;
  institutionName: string | null;
  mask: string | null;
  transactionId: string | null;
  txnType: string | null;
  txnVoid: boolean;
  payeeContactId: string | null;
  payeeName: string | null;
  categoryAccountId: string | null;
  categoryAccountName: string | null;
  categoryCount: number;
  suggestedAccountName: string | null;
  reviewedAt: string | null;
}

function scopeQs(input: SummaryInput): URLSearchParams {
  const qs = new URLSearchParams();
  if (input.companyId) qs.set('companyId', input.companyId);
  qs.set('periodStart', input.periodStart.slice(0, 10));
  qs.set('periodEnd', input.periodEnd.slice(0, 10));
  return qs;
}

export function useFeedReviewSummary(input: SummaryInput, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['practice', 'classification', 'feed-review', 'summary', input.companyId, input.periodStart, input.periodEnd],
    queryFn: () =>
      apiClient<FeedReviewSummary>(`/practice/classification/feed-review/summary?${scopeQs(input).toString()}`),
    staleTime: 15 * 1000,
  });
}

const FEED_REVIEW_PAGE = 100;

export function useFeedReviewList(input: SummaryInput & {
  method?: FeedReviewMethod;
  status: FeedReviewStatus;
  sortBy?: FeedReviewSortKey;
  sortDir?: 'asc' | 'desc';
}) {
  return useInfiniteQuery({
    queryKey: [
      'practice', 'classification', 'feed-review', 'list',
      input.companyId, input.periodStart, input.periodEnd, input.method ?? null, input.status,
      input.sortBy ?? null, input.sortDir ?? null,
    ],
    queryFn: ({ pageParam }) => {
      const qs = scopeQs(input);
      if (input.method) qs.set('method', input.method);
      qs.set('status', input.status);
      if (input.sortBy) {
        qs.set('sortBy', input.sortBy);
        qs.set('sortDir', input.sortDir ?? 'asc');
      }
      qs.set('limit', String(FEED_REVIEW_PAGE));
      qs.set('offset', String(pageParam));
      return apiClient<{ rows: FeedReviewRow[]; total: number }>(
        `/practice/classification/feed-review?${qs.toString()}`,
      );
    },
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.rows.length, 0);
      return loaded < last.total && last.rows.length > 0 ? loaded : undefined;
    },
    staleTime: 15 * 1000,
  });
}

function useFeedReviewInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['practice', 'classification'] });
    // The Overview checklist carries the "X of N reviewed" task.
    qc.invalidateQueries({ queryKey: ['practice', 'checks'] });
  };
}

export function useMarkFeedReviewed() {
  const invalidate = useFeedReviewInvalidate();
  return useMutation({
    mutationFn: (input: { feedItemIds: string[]; reviewed: boolean; companyId: string | null }) =>
      apiClient<{ updated: number }>('/practice/classification/feed-review/mark', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

export function useRecategorizeFeedItems() {
  const invalidate = useFeedReviewInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { feedItemIds: string[]; accountId?: string; contactId?: string; companyId: string | null }) =>
      apiClient<{ updated: number; skipped: Array<{ feedItemId: string; reason: string }> }>(
        '/practice/classification/feed-review/recategorize',
        { method: 'POST', body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      invalidate();
      // A category move shifts account balances and the registers.
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
