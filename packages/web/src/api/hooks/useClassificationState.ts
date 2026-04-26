// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BucketSummary,
  BucketRow,
  ClassificationBucket,
  ClassificationState,
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
