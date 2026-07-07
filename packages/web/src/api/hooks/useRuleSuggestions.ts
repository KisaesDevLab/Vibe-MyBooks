// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface RuleSuggestion {
  payeePattern: string;
  accountId: string;
  accountName: string;
  timesConfirmed: number;
  overrideRate: number;
  proposedRule: {
    name: string;
    conditions: { type: 'leaf'; field: 'descriptor'; operator: 'contains'; value: string };
    actions: Array<{ type: 'set_account'; accountId: string }>;
  };
}

// Phase 5b §5.7 — auto-suggest. Computed on-demand on the
// server when the Rules page mounts; cached client-side for
// 5 min to avoid recomputing on every navigation back.
export function useRuleSuggestions() {
  return useQuery({
    queryKey: ['practice', 'conditional-rules', 'suggestions'],
    queryFn: () =>
      apiClient<{ suggestions: RuleSuggestion[] }>('/practice/conditional-rules/suggestions'),
    staleTime: 5 * 60 * 1000,
  });
}

// Permanently dismiss a suggestion. Suggestions carry no id, so we send
// the identifying (payeePattern, accountId) tuple; the server persists a
// suppression row that detectSuggestions filters against. Invalidates the
// suggestions query so the dismissed row drops out of the list.
export function useDismissRuleSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { payeePattern: string; accountId: string }) =>
      apiClient<void>('/practice/conditional-rules/suggestions/dismiss', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['practice', 'conditional-rules', 'suggestions'] }),
  });
}
