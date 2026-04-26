// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CheckRegistryEntry,
  CheckRun,
  CheckSuppression,
  Finding,
  FindingSeverity,
  FindingStatus,
} from '@kis-books/shared';
import { apiClient } from '../client';

// Phase 6 + 7 — review-checks read API. All routes live under
// /api/v1/practice/checks and are gated by the CLOSE_REVIEW_V1
// feature flag at the route level. Hooks trust the gate.

const KEYS = {
  registry: ['practice', 'checks', 'registry'] as const,
  findings: (filters: FindingsListInput) =>
    ['practice', 'checks', 'findings', filters] as const,
  finding: (id: string) =>
    ['practice', 'checks', 'finding', id] as const,
  events: (id: string) =>
    ['practice', 'checks', 'finding-events', id] as const,
  summary: (companyId: string | null) =>
    ['practice', 'checks', 'summary', companyId] as const,
  runs: (limit: number) => ['practice', 'checks', 'runs', limit] as const,
  suppressions: ['practice', 'checks', 'suppressions'] as const,
  overrides: ['practice', 'checks', 'overrides'] as const,
};

export function useCheckRegistry() {
  return useQuery({
    queryKey: KEYS.registry,
    queryFn: () => apiClient<{ checks: CheckRegistryEntry[] }>('/practice/checks/registry'),
    staleTime: 5 * 60 * 1000,
  });
}

export interface FindingsListInput {
  status?: FindingStatus;
  severity?: FindingSeverity;
  checkKey?: string;
  companyId?: string | null;
  cursor?: string;
  limit?: number;
}

interface FindingsListResponse {
  rows: Finding[];
  nextCursor: string | null;
}

export function useFindings(input: FindingsListInput) {
  const qs = new URLSearchParams();
  if (input.status) qs.set('status', input.status);
  if (input.severity) qs.set('severity', input.severity);
  if (input.checkKey) qs.set('checkKey', input.checkKey);
  if (input.companyId) qs.set('companyId', input.companyId);
  if (input.cursor) qs.set('cursor', input.cursor);
  if (input.limit) qs.set('limit', String(input.limit));
  return useQuery({
    queryKey: KEYS.findings(input),
    queryFn: () =>
      apiClient<FindingsListResponse>(
        `/practice/checks/findings${qs.toString() ? `?${qs.toString()}` : ''}`,
      ),
    staleTime: 15 * 1000,
  });
}

export function useFinding(id: string | null) {
  return useQuery({
    queryKey: id ? KEYS.finding(id) : ['practice', 'checks', 'finding', 'none'],
    enabled: !!id,
    queryFn: () => apiClient<Finding>(`/practice/checks/findings/${id}`),
  });
}

export interface FindingEventRow {
  id: string;
  findingId: string;
  fromStatus: FindingStatus | null;
  toStatus: FindingStatus;
  userId: string | null;
  note: string | null;
  createdAt: string;
}

export function useFindingEvents(id: string | null) {
  return useQuery({
    queryKey: id ? KEYS.events(id) : ['practice', 'checks', 'finding-events', 'none'],
    enabled: !!id,
    queryFn: () =>
      apiClient<{ events: FindingEventRow[] }>(`/practice/checks/findings/${id}/events`),
  });
}

export interface FindingsSummary {
  byStatus: Record<FindingStatus, number>;
  bySeverity: Record<FindingSeverity, number>;
  total: number;
}

export function useFindingsSummary(companyId: string | null) {
  const qs = companyId ? `?companyId=${companyId}` : '';
  return useQuery({
    queryKey: KEYS.summary(companyId),
    queryFn: () =>
      apiClient<FindingsSummary>(`/practice/checks/findings-summary${qs}`),
    staleTime: 15 * 1000,
  });
}

export interface RunResultClient {
  runId: string;
  checksExecuted: number;
  findingsCreated: number;
  truncated: boolean;
  error: string | null;
}

// "Run checks now" trigger. Body is `{companyId?}`. Server
// returns one RunResult per company executed. Invalidates every
// findings query so the dashboard refreshes immediately.
export function useRunChecks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { companyId?: string | null }) =>
      apiClient<{ runs: RunResultClient[] }>('/practice/checks/run', {
        method: 'POST',
        body: JSON.stringify(input.companyId ? { companyId: input.companyId } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practice', 'checks'] });
      qc.invalidateQueries({ queryKey: ['practice', 'classification'] });
    },
  });
}

// "Run AI judgment" trigger. Same body shape as useRunChecks but
// hits the separate /run-ai-judgment endpoint that opts in to AI
// handlers. Gated server-side by the AI_JUDGMENT_CHECKS_V1 flag.
export function useRunAiJudgment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { companyId?: string | null }) =>
      apiClient<{ runs: RunResultClient[] }>('/practice/checks/run-ai-judgment', {
        method: 'POST',
        body: JSON.stringify(input.companyId ? { companyId: input.companyId } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practice', 'checks'] });
    },
  });
}

export function useCheckRuns(limit: number = 20) {
  return useQuery({
    queryKey: KEYS.runs(limit),
    queryFn: () =>
      apiClient<{ runs: CheckRun[] }>(`/practice/checks/runs?limit=${limit}`),
    staleTime: 30 * 1000,
  });
}

export interface TransitionFindingInput {
  id: string;
  status: FindingStatus;
  note?: string;
  assignedTo?: string | null;
  resolutionNote?: string;
}

export function useTransitionFinding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TransitionFindingInput) =>
      apiClient<Finding>(`/practice/checks/findings/${input.id}/transition`, {
        method: 'POST',
        body: JSON.stringify({
          status: input.status,
          note: input.note,
          assignedTo: input.assignedTo,
          resolutionNote: input.resolutionNote,
        }),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['practice', 'checks'] });
      qc.invalidateQueries({ queryKey: KEYS.finding(vars.id) });
      qc.invalidateQueries({ queryKey: KEYS.events(vars.id) });
    },
  });
}

export interface BulkTransitionInput {
  ids: string[];
  status: FindingStatus;
  note?: string;
  assignedTo?: string | null;
  resolutionNote?: string;
}

interface BulkTransitionResult {
  updated: string[];
  failed: Array<{ id: string; reason: string }>;
}

export function useBulkTransitionFindings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkTransitionInput) =>
      apiClient<BulkTransitionResult>('/practice/checks/findings/bulk-transition', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practice', 'checks'] });
    },
  });
}

export function useSuppressions() {
  return useQuery({
    queryKey: KEYS.suppressions,
    queryFn: () =>
      apiClient<{ suppressions: CheckSuppression[] }>(`/practice/checks/suppressions`),
    staleTime: 60 * 1000,
  });
}

export interface CreateSuppressionInputClient {
  checkKey: string;
  companyId?: string | null;
  matchPattern: {
    transactionId?: string;
    vendorId?: string;
    payloadEquals?: Record<string, unknown>;
  };
  reason?: string;
  expiresAt?: string;
}

export function useCreateSuppression() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSuppressionInputClient) =>
      apiClient<CheckSuppression>(`/practice/checks/suppressions`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.suppressions });
      qc.invalidateQueries({ queryKey: ['practice', 'checks', 'findings'] });
    },
  });
}

export interface CheckOverrideRow {
  checkKey: string;
  companyId: string | null;
  params: Record<string, unknown>;
}

export function useCheckOverrides() {
  return useQuery({
    queryKey: KEYS.overrides,
    queryFn: () =>
      apiClient<{ overrides: CheckOverrideRow[] }>('/practice/checks/overrides'),
    staleTime: 60 * 1000,
  });
}

export interface SetCheckOverrideInput {
  checkKey: string;
  companyId?: string | null;
  params: Record<string, unknown>;
}

export function useSetCheckOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SetCheckOverrideInput) =>
      apiClient<{ updated: true }>(`/practice/checks/overrides/${input.checkKey}`, {
        method: 'PUT',
        body: JSON.stringify({ companyId: input.companyId ?? null, params: input.params }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.overrides });
    },
  });
}

export function useDeleteCheckOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { checkKey: string; companyId?: string | null }) => {
      const qs = input.companyId ? `?companyId=${input.companyId}` : '';
      return apiClient<{ deleted: true }>(
        `/practice/checks/overrides/${input.checkKey}${qs}`,
        { method: 'DELETE' },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.overrides });
    },
  });
}
