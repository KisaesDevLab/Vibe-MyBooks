// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActionsField,
  ConditionAST,
  ConditionalRule,
  ConditionalRuleStats,
  FirmRole,
  RuleScope,
} from '@kis-books/shared';
import { apiClient } from '../client';

// Wire input types declared inline rather than imported as
// z.infer<...> from the shared schema. The Zod schema's
// recursive type uses unexported local interfaces, which would
// break declaration emit when this hook's return type is
// re-exported from a parent module.
export interface CreateConditionalRuleWireInput {
  name: string;
  companyId?: string | null;
  priority?: number;
  conditions: ConditionAST;
  actions: ActionsField;
  continueAfterMatch?: boolean;
  active?: boolean;
  // 3-tier rules plan, Phase 5 — optional scope selector. The
  // builder defaults to tenant_user; firm_admin users can pick
  // tenant_firm or global_firm. The server-side `assertCanAuthorScope`
  // middleware enforces the role gate.
  scope?: RuleScope;
}
export type UpdateConditionalRuleWireInput = Partial<CreateConditionalRuleWireInput>;

// Phase 4 returns rules with a merged `stats` field per row, so
// the list page renders fires/overrides without a second fetch.
interface RuleWithStats extends ConditionalRule {
  stats: ConditionalRuleStats | null;
}

// 3-tier rules plan, Phase 5 — list response also carries the
// resolved firm context so the UI doesn't have to make a parallel
// firm-context query. firmId / firmRole are null on solo books;
// the page uses these to gate transition buttons.
interface ListResponse {
  rules: RuleWithStats[];
  firmId: string | null;
  firmRole: FirmRole | null;
}

export function useConditionalRules(opts?: { scope?: RuleScope }) {
  const qs = opts?.scope ? `?scope=${opts.scope}` : '';
  return useQuery({
    queryKey: ['practice', 'conditional-rules', opts?.scope ?? 'all'],
    queryFn: () => apiClient<ListResponse>(`/practice/conditional-rules${qs}`),
    staleTime: 30 * 1000,
  });
}

export function useConditionalRule(id: string | null) {
  return useQuery({
    queryKey: ['practice', 'conditional-rules', id],
    enabled: !!id,
    queryFn: () => apiClient<ConditionalRule>(`/practice/conditional-rules/${id}`),
  });
}

export function useCreateConditionalRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConditionalRuleWireInput) =>
      apiClient<ConditionalRule>('/practice/conditional-rules', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practice', 'conditional-rules'] }),
  });
}

export function useUpdateConditionalRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; patch: UpdateConditionalRuleWireInput }) =>
      apiClient<ConditionalRule>(`/practice/conditional-rules/${input.id}`, {
        method: 'PUT',
        body: JSON.stringify(input.patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practice', 'conditional-rules'] }),
  });
}

export function useDeleteConditionalRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ deleted: boolean }>(`/practice/conditional-rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practice', 'conditional-rules'] }),
  });
}

export function useReorderConditionalRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) =>
      apiClient<{ reordered: number }>('/practice/conditional-rules/reorder', {
        method: 'POST',
        body: JSON.stringify({ orderedIds }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practice', 'conditional-rules'] }),
  });
}

// 3-tier rules plan, Phase 5 — tier-transition mutations.
// Promote / demote / fork are gated server-side on RULES_TIERED_V1;
// the UI only renders the buttons when the parent fetch has
// returned a non-null firmRole, so most callers won't see the
// 404-when-flag-OFF error path.

export function usePromoteConditionalRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; confirmActionShapes?: boolean }) =>
      apiClient<ConditionalRule>(`/practice/conditional-rules/${input.id}/promote`, {
        method: 'POST',
        body: JSON.stringify({ confirmActionShapes: input.confirmActionShapes }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practice', 'conditional-rules'] }),
  });
}

export function useDemoteConditionalRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; tenantId?: string }) =>
      apiClient<ConditionalRule>(`/practice/conditional-rules/${input.id}/demote`, {
        method: 'POST',
        body: JSON.stringify({ tenantId: input.tenantId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practice', 'conditional-rules'] }),
  });
}

export function useForkConditionalRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; tenantId: string }) =>
      apiClient<ConditionalRule>(`/practice/conditional-rules/${input.id}/fork-to-tenant`, {
        method: 'POST',
        body: JSON.stringify({ tenantId: input.tenantId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practice', 'conditional-rules'] }),
  });
}

export function useTenantOverrides(globalRuleId: string | null) {
  return useQuery({
    queryKey: ['practice', 'conditional-rules', globalRuleId, 'tenant-overrides'],
    enabled: !!globalRuleId,
    queryFn: () =>
      apiClient<{
        overrides: Array<{ ruleId: string; tenantId: string; name: string; updatedAt: string }>;
      }>(`/practice/conditional-rules/${globalRuleId}/tenant-overrides`),
  });
}

export type { RuleWithStats };
