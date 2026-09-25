// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  summary: (companyId: string | null, periodStart?: string) =>
    ['practice', 'checks', 'summary', companyId, periodStart ?? null] as const,
  runs: (limit: number, companyId?: string | null, periodStart?: string) =>
    ['practice', 'checks', 'runs', limit, companyId ?? null, periodStart ?? null] as const,
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
  // Close-period scope. Findings stamped with a run period inside
  // [periodStart, periodEnd) are returned. Included in the query key
  // so switching months refetches.
  periodStart?: string;
  periodEnd?: string;
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
  if (input.periodStart) qs.set('periodStart', input.periodStart);
  if (input.periodEnd) qs.set('periodEnd', input.periodEnd);
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

// Cursor-accumulating variant of useFindings: "Load more" appends
// the next page instead of replacing the list, so periods with more
// findings than one page stay fully reachable. Invalidation on
// ['practice', 'checks'] refetches every loaded page.
export function useFindingsInfinite(input: Omit<FindingsListInput, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: [...KEYS.findings(input), 'infinite'],
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams();
      if (input.status) qs.set('status', input.status);
      if (input.severity) qs.set('severity', input.severity);
      if (input.checkKey) qs.set('checkKey', input.checkKey);
      if (input.companyId) qs.set('companyId', input.companyId);
      if (input.periodStart) qs.set('periodStart', input.periodStart);
      if (input.periodEnd) qs.set('periodEnd', input.periodEnd);
      if (pageParam) qs.set('cursor', pageParam);
      if (input.limit) qs.set('limit', String(input.limit));
      return apiClient<FindingsListResponse>(
        `/practice/checks/findings${qs.toString() ? `?${qs.toString()}` : ''}`,
      );
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
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

// Scoped exactly like the findings list, so a card's count always matches
// the rows the list can show for the same period.
export function useFindingsSummary(companyId: string | null, period?: { periodStart: string; periodEnd: string }) {
  const params = new URLSearchParams();
  if (companyId) params.set('companyId', companyId);
  if (period) { params.set('periodStart', period.periodStart); params.set('periodEnd', period.periodEnd); }
  const qs = params.toString() ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: KEYS.summary(companyId, period?.periodStart),
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
    mutationFn: (input: { companyId?: string | null; periodStart: string; periodEnd: string }) =>
      apiClient<{ runs: RunResultClient[] }>('/practice/checks/run', {
        method: 'POST',
        body: JSON.stringify({
          ...(input.companyId ? { companyId: input.companyId } : {}),
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practice', 'checks'] });
      qc.invalidateQueries({ queryKey: ['practice', 'classification'] });
    },
  });
}

// "Run AI judgment" trigger: runs ONLY the AI checks, for the selected
// close period. Gated server-side by the AI_JUDGMENT_CHECKS_V1 flag.
export function useRunAiJudgment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { companyId?: string | null; periodStart: string; periodEnd: string }) =>
      apiClient<{ runs: RunResultClient[] }>('/practice/checks/run-ai-judgment', {
        method: 'POST',
        body: JSON.stringify({
          ...(input.companyId ? { companyId: input.companyId } : {}),
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practice', 'checks'] });
    },
  });
}

export function useCheckRuns(limit: number = 20, scope: { companyId?: string | null; periodStart?: string } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (scope.companyId) params.set('companyId', scope.companyId);
  if (scope.periodStart) params.set('periodStart', scope.periodStart);
  return useQuery({
    queryKey: KEYS.runs(limit, scope.companyId, scope.periodStart),
    queryFn: () =>
      apiClient<{ runs: CheckRun[] }>(`/practice/checks/runs?${params.toString()}`),
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

// ── Close checklist ─────────────────────────────────────────────

export interface CloseChecklistTask {
  key: string;
  section: 'reconciliations' | 'transactions' | 'review' | 'final';
  label: string;
  auto: boolean;
  done: boolean;
  detail: string | null;
  manuallyCompleted: boolean;
  completedAt: string | null;
  note: string | null;
}

const checklistKey = (companyId: string | null, periodStart: string, periodEnd?: string) =>
  ['practice', 'checks', 'checklist', companyId, periodStart, periodEnd ?? null] as const;

export function useCloseChecklist(companyId: string | null, periodStart: string, periodEnd: string) {
  return useQuery({
    queryKey: checklistKey(companyId, periodStart, periodEnd),
    queryFn: () => {
      const qs = new URLSearchParams({ periodStart, periodEnd });
      if (companyId) qs.set('companyId', companyId);
      return apiClient<{ tasks: CloseChecklistTask[] }>(`/practice/checks/checklist?${qs.toString()}`);
    },
  });
}

export function useCompleteChecklistTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { companyId?: string | null; periodStart: string; taskKey: string; note?: string | null }) =>
      apiClient<{ completed: true }>('/practice/checks/checklist/complete', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (_r, input) => {
      // Prefix match (no periodEnd) — invalidates the period's entry
      // regardless of which periodEnd variant fetched it.
      qc.invalidateQueries({ queryKey: ['practice', 'checks', 'checklist', input.companyId ?? null, input.periodStart] });
    },
  });
}

export function useReopenChecklistTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { companyId?: string | null; periodStart: string; taskKey: string }) =>
      apiClient<{ reopened: true }>('/practice/checks/checklist/reopen', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (_r, input) => {
      // Prefix match (no periodEnd) — invalidates the period's entry
      // regardless of which periodEnd variant fetched it.
      qc.invalidateQueries({ queryKey: ['practice', 'checks', 'checklist', input.companyId ?? null, input.periodStart] });
    },
  });
}

// ── Close workspace ────────────────────────────────────────────────

export interface ReportCount { checkKey: string; open: number; accepted: number; excluded: number }

function closeQs(companyId: string | null, periodStart: string, periodEnd: string) {
  const p = new URLSearchParams({ periodStart, periodEnd });
  if (companyId) p.set('companyId', companyId);
  return p.toString();
}

export function useReportCounts(companyId: string | null, periodStart: string, periodEnd: string) {
  return useQuery({
    queryKey: ['practice', 'checks', 'reports', companyId, periodStart] as const,
    queryFn: () => apiClient<{ counts: ReportCount[] }>(`/practice/checks/reports?${closeQs(companyId, periodStart, periodEnd)}`),
    staleTime: 15 * 1000,
  });
}

export interface CloseRecordClient {
  companyId: string | null;
  periodStart: string;
  periodEnd: string;
  status: 'not_started' | 'in_progress' | 'prepared' | 'closed';
  preparedBy: string | null;
  preparedByName: string | null;
  preparedAt: string | null;
  preparedNote: string | null;
  reviewedBy: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewedNote: string | null;
  openFindings: number;
  hasRun: boolean;
}

export function useCloseRecord(companyId: string | null, periodStart: string, periodEnd: string) {
  return useQuery({
    queryKey: ['practice', 'checks', 'close', companyId, periodStart] as const,
    queryFn: () => apiClient<{ close: CloseRecordClient }>(`/practice/checks/close?${closeQs(companyId, periodStart, periodEnd)}`),
    staleTime: 10 * 1000,
  });
}

export function useSignClose() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { companyId?: string | null; periodStart: string; periodEnd: string; role: 'preparer' | 'reviewer'; note?: string }) =>
      apiClient<{ close: CloseRecordClient }>('/practice/checks/close/sign', {
        method: 'POST',
        body: JSON.stringify({
          ...(input.companyId ? { companyId: input.companyId } : {}),
          periodStart: input.periodStart, periodEnd: input.periodEnd, role: input.role,
          ...(input.note ? { note: input.note } : {}),
        }),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['practice', 'checks', 'close'] }); },
  });
}

export function useUndoCloseSignoff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { companyId?: string | null; periodStart: string; periodEnd: string }) =>
      apiClient<{ close: CloseRecordClient }>('/practice/checks/close/undo', {
        method: 'POST',
        body: JSON.stringify({
          ...(input.companyId ? { companyId: input.companyId } : {}),
          periodStart: input.periodStart, periodEnd: input.periodEnd,
        }),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['practice', 'checks', 'close'] }); },
  });
}

export interface PayeeHistory {
  payeeId: string | null;
  payeeName: string | null;
  rows: Array<{ accountId: string; accountName: string; count: number; total: string }>;
}

export function usePayeeHistory(findingId: string | null) {
  return useQuery({
    queryKey: ['practice', 'checks', 'payee-history', findingId] as const,
    queryFn: () => apiClient<PayeeHistory>(`/practice/checks/findings/${findingId}/payee-history`),
    enabled: !!findingId,
    staleTime: 60 * 1000,
  });
}
