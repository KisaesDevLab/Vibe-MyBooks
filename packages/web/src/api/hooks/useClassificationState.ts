// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BucketSummary,
  BucketRow,
  ClassificationBucket,
  ClassificationState,
  RuleExceptionRow,
  VendorEnrichment,
} from '@kis-books/shared';
import { apiClient } from '../client';

// All hooks are gated by the feature flag at the route level
// (PracticeLayout redirects) and at the API level
// (/api/v1/practice/classification returns 404 when the flag is
// off for the tenant). These hooks trust the gate and fetch
// unconditionally when called.

const KEYS = {
  summary: (companyId: string | null, start: string, end: string) =>
    ['practice', 'classification', 'summary', companyId, start, end] as const,
  bucket: (bucket: ClassificationBucket, companyId: string | null, start: string, end: string) =>
    ['practice', 'classification', 'bucket', bucket, companyId, start, end] as const,
  vendorEnrichment: (stateId: string) =>
    ['practice', 'classification', 'vendor-enrichment', stateId] as const,
};

export interface SummaryInput {
  companyId: string | null;
  periodStart: string;
  periodEnd: string;
}

export function useSummary(input: SummaryInput) {
  const qs = new URLSearchParams();
  if (input.companyId) qs.set('companyId', input.companyId);
  qs.set('periodStart', input.periodStart);
  qs.set('periodEnd', input.periodEnd);
  return useQuery({
    queryKey: KEYS.summary(input.companyId, input.periodStart, input.periodEnd),
    queryFn: () => apiClient<BucketSummary>(`/practice/classification/summary?${qs.toString()}`),
    staleTime: 30 * 1000,
  });
}

export interface BucketInput extends SummaryInput {
  bucket: ClassificationBucket;
  cursor?: string;
  limit?: number;
}

interface BucketResponse {
  rows: BucketRow[];
  nextCursor: string | null;
}

export function useBucket(input: BucketInput) {
  const qs = new URLSearchParams();
  if (input.companyId) qs.set('companyId', input.companyId);
  qs.set('periodStart', input.periodStart);
  qs.set('periodEnd', input.periodEnd);
  if (input.cursor) qs.set('cursor', input.cursor);
  if (input.limit) qs.set('limit', String(input.limit));
  return useQuery({
    queryKey: [...KEYS.bucket(input.bucket, input.companyId, input.periodStart, input.periodEnd), input.cursor ?? ''],
    queryFn: () =>
      apiClient<BucketResponse>(
        `/practice/classification/bucket/${input.bucket}?${qs.toString()}`,
      ),
    staleTime: 15 * 1000,
  });
}

// Cursor-accumulating variant of useBucket: pages are appended via
// "Load more" instead of replaced, so long buckets are reachable.
// Invalidation on ['practice', 'classification'] refetches every
// loaded page, keeping approved rows from lingering in the list.
export function useBucketInfinite(input: Omit<BucketInput, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: [
      ...KEYS.bucket(input.bucket, input.companyId, input.periodStart, input.periodEnd),
      'infinite',
      input.limit ?? null,
    ],
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams();
      if (input.companyId) qs.set('companyId', input.companyId);
      qs.set('periodStart', input.periodStart);
      qs.set('periodEnd', input.periodEnd);
      if (pageParam) qs.set('cursor', pageParam);
      if (input.limit) qs.set('limit', String(input.limit));
      return apiClient<BucketResponse>(
        `/practice/classification/bucket/${input.bucket}?${qs.toString()}`,
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 15 * 1000,
  });
}

export function useApprove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (stateIds: string[]) =>
      apiClient<{ approved: string[]; failed: Array<{ stateId: string; reason: string }> }>(
        '/practice/classification/approve',
        { method: 'POST', body: JSON.stringify({ stateIds }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practice', 'classification'] });
    },
  });
}

export interface ApproveAllInput {
  bucket: ClassificationBucket;
  companyId: string | null;
  periodStart: string;
  periodEnd: string;
  confirm?: boolean;
}

export function useApproveAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ApproveAllInput) =>
      apiClient<{ approved: string[]; failed: Array<{ stateId: string; reason: string }> }>(
        '/practice/classification/approve-all',
        { method: 'POST', body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practice', 'classification'] });
    },
  });
}

export function useReclassify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { stateId: string; bucket: ClassificationBucket }) =>
      apiClient<ClassificationState>(
        `/practice/classification/${input.stateId}/reclassify`,
        { method: 'POST', body: JSON.stringify({ bucket: input.bucket }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practice', 'classification'] });
    },
  });
}

interface VendorEnrichmentResponse {
  enrichment: VendorEnrichment | null;
  source: 'cache' | 'ai' | 'none';
}

// "Ask Client" — opens a portal question against the bank-feed
// item. The server formats a context line (date · description ·
// amount) and prepends it to the body so the bookkeeper doesn't
// have to retype the transaction context.
export interface AskClientInput {
  stateId: string;
  body: string;
  assignedContactId?: string | null;
}

export function useAskClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AskClientInput) =>
      apiClient<{ questionId: string }>(
        `/practice/classification/${input.stateId}/ask-client`,
        {
          method: 'POST',
          body: JSON.stringify({
            body: input.body,
            assignedContactId: input.assignedContactId ?? null,
          }),
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practice', 'classification'] });
      qc.invalidateQueries({ queryKey: ['portal', 'questions'] });
    },
  });
}

export function useVendorEnrichment(stateId: string | null) {
  return useQuery({
    queryKey: stateId ? KEYS.vendorEnrichment(stateId) : ['practice', 'classification', 'vendor-enrichment', 'none'],
    enabled: !!stateId,
    queryFn: () =>
      apiClient<VendorEnrichmentResponse>(`/practice/classification/${stateId}/vendor-enrichment`),
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Rule-exception audit (Buckets → Rules) ──────────────────────

export interface RuleExceptionsInput {
  companyId: string | null;
  periodStart: string;
  periodEnd: string;
}

export function useRuleExceptions(input: RuleExceptionsInput) {
  const qs = new URLSearchParams();
  if (input.companyId) qs.set('companyId', input.companyId);
  qs.set('periodStart', input.periodStart);
  qs.set('periodEnd', input.periodEnd);
  return useQuery({
    queryKey: ['practice', 'classification', 'rule-exceptions', input.companyId, input.periodStart, input.periodEnd],
    queryFn: () =>
      apiClient<{ exceptions: RuleExceptionRow[] }>(
        `/practice/classification/rule-exceptions?${qs.toString()}`,
      ),
    staleTime: 15 * 1000,
  });
}

export function useAcceptRuleException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { transactionId: string; companyId: string | null }) => {
      const qs = new URLSearchParams();
      if (input.companyId) qs.set('companyId', input.companyId);
      return apiClient<{ accepted: boolean; ruleAccountId: string; ruleAccountName: string }>(
        `/practice/classification/rule-exceptions/${input.transactionId}/accept?${qs.toString()}`,
        { method: 'POST' },
      );
    },
    onSuccess: () => {
      // The re-book changes a posted transaction's category, so invalidate the
      // whole practice-classification surface plus the transactions list.
      qc.invalidateQueries({ queryKey: ['practice', 'classification'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useDismissRuleException() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { transactionId: string; ruleId?: string }) =>
      apiClient<{ dismissed: boolean }>(
        `/practice/classification/rule-exceptions/${input.transactionId}/dismiss`,
        { method: 'POST', body: JSON.stringify({ ruleId: input.ruleId }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practice', 'classification', 'rule-exceptions'] });
    },
  });
}

// ── Bank feed review (Close Review reviewer pass) ──────────────────
// The period's already-categorized / matched / excluded bank-feed items,
// how each got its category, and the reviewer's "Looks right" mark.

export type FeedReviewMethod = 'rule' | 'ai' | 'history' | 'check_image' | 'manual' | 'matched' | 'excluded';
export type FeedReviewStatus = 'todo' | 'reviewed' | 'all';

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

export function useFeedReviewList(input: SummaryInput & { method?: FeedReviewMethod; status: FeedReviewStatus }) {
  return useInfiniteQuery({
    queryKey: [
      'practice', 'classification', 'feed-review', 'list',
      input.companyId, input.periodStart, input.periodEnd, input.method ?? null, input.status,
    ],
    queryFn: ({ pageParam }) => {
      const qs = scopeQs(input);
      if (input.method) qs.set('method', input.method);
      qs.set('status', input.status);
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
