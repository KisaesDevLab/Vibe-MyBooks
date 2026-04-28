// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMutation, useQuery } from '@tanstack/react-query';
import type { Action, ActionsField, ConditionAST, ConditionalRuleContext } from '@kis-books/shared';
import { apiClient } from '../client';

interface SandboxRuleBody {
  conditions: ConditionAST;
  actions: ActionsField;
}

// Mirrors the engine's ConditionTrace shape. Inlined here so the
// hook stays usable without a circular dep on api package types.
export type ConditionTraceWire =
  | { kind: 'leaf'; field: string; operator: string; value: unknown; matched: boolean; error?: string }
  | { kind: 'group'; op: 'AND' | 'OR'; matched: boolean; children: ConditionTraceWire[] };

interface RunSampleResult {
  matched: boolean;
  trace: ConditionTraceWire;
  appliedActions: Action[];
  context: ConditionalRuleContext;
}

interface BatchSampleHit {
  bankFeedItemId: string;
  description: string | null;
  amount: string;
  feedDate: string;
  appliedActions: Action[];
}

interface RunBatchResult {
  totalScanned: number;
  totalMatched: number;
  firstMatches: BatchSampleHit[];
}

interface RecentSample {
  id: string;
  description: string | null;
  amount: string;
  feedDate: string;
  bankConnectionId: string;
}

export function useRunSandbox() {
  return useMutation({
    mutationFn: (input: { rule: SandboxRuleBody; sampleFeedItemId?: string; sampleContext?: ConditionalRuleContext }) =>
      apiClient<RunSampleResult>('/practice/conditional-rules/sandbox/run', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export function useRunBatchSandbox() {
  return useMutation({
    mutationFn: (input: { rule: SandboxRuleBody; limit?: number }) =>
      apiClient<RunBatchResult>('/practice/conditional-rules/sandbox/run-batch', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export function useRecentSamples() {
  return useQuery({
    queryKey: ['practice', 'conditional-rules', 'recent-samples'],
    queryFn: () =>
      apiClient<{ samples: RecentSample[] }>('/practice/conditional-rules/sandbox/recent-samples'),
    staleTime: 60 * 1000,
  });
}

// One row per bank connection in the tenant. The rule builder
// renders this as a dropdown for the `account_source_id` leaf
// condition so authors pick by friendly name and the persisted
// rule body holds the GL account uuid the engine compares.
export interface BankSourceAccount {
  accountId: string;
  accountName: string;
  connectionId: string;
  institutionName: string | null;
  mask: string | null;
}

export function useBankSourceAccounts() {
  return useQuery({
    queryKey: ['practice', 'conditional-rules', 'bank-source-accounts'],
    queryFn: () =>
      apiClient<{ accounts: BankSourceAccount[] }>('/practice/conditional-rules/bank-source-accounts'),
    staleTime: 5 * 60 * 1000,
  });
}
