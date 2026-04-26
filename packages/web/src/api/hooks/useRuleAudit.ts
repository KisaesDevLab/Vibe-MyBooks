// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery } from '@tanstack/react-query';
import type { Action } from '@kis-books/shared';
import { apiClient } from '../client';

export interface RuleAuditRow {
  id: string;
  tenantId: string;
  ruleId: string;
  bankFeedItemId: string | null;
  transactionId: string | null;
  matchedAt: string;
  actionsApplied: Action[] | null;
  wasOverridden: boolean;
  overriddenAt: string | null;
}

interface AuditResponse {
  rows: RuleAuditRow[];
  nextCursor: string | null;
}

// Phase 5b §5.6 — paginated audit log per rule. Cursor-based.
// `enabled: !!ruleId` so the hook is safe to call with null
// while the editor is still on a different tab.
export function useRuleAudit(ruleId: string | null, cursor?: string) {
  return useQuery({
    queryKey: ['practice', 'conditional-rules', 'audit', ruleId, cursor ?? null],
    enabled: !!ruleId,
    queryFn: () => {
      const qs = new URLSearchParams();
      if (cursor) qs.set('cursor', cursor);
      qs.set('limit', '50');
      return apiClient<AuditResponse>(`/practice/conditional-rules/${ruleId}/audit?${qs.toString()}`);
    },
    staleTime: 30 * 1000,
  });
}
