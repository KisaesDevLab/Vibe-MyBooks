// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import {
  useBucket,
  useRuleExceptions,
  useAcceptRuleException,
  useDismissRuleException,
} from '../../../../api/hooks/useClassificationState';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { Button } from '../../../../components/ui/Button';
import { BucketTable } from './BucketTable';
import type { ClosePeriod } from '../ClosePeriodSelector';

interface Props {
  companyId: string | null;
  period: ClosePeriod;
}

const currency = (v: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Math.abs(parseFloat(v) || 0),
  );

// Rule Exceptions — POSTED transactions in the period whose booked category
// account differs from what a Practice Rule would assign. Accept re-books the
// one transaction to the rule's account; Dismiss suppresses it. Renders
// nothing when there are no exceptions (or the feature isn't reachable).
function RuleExceptionsSection({ companyId, period }: Props) {
  const query = useRuleExceptions({
    companyId,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  });
  const accept = useAcceptRuleException();
  const dismiss = useDismissRuleException();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const exceptions = query.data?.exceptions ?? [];
  if (query.isLoading || exceptions.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-200">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <span className="text-sm font-semibold text-amber-900">
          Rule exceptions
        </span>
        <span className="text-xs font-medium text-amber-700">
          {exceptions.length} booked to a different account than a rule assigns
        </span>
      </div>
      <div className="divide-y divide-amber-100">
        {exceptions.map((ex) => {
          const busy = pendingId === ex.transactionId && (accept.isPending || dismiss.isPending);
          return (
            <div key={ex.transactionId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 bg-white">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {ex.payee || ex.descriptor || '(no payee)'}
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    {ex.date} · {currency(ex.amount)}
                  </span>
                </div>
                <div className="text-xs text-gray-600 mt-0.5">
                  Booked: <span className="font-medium text-gray-800">{ex.currentAccountName}</span>
                  <span className="mx-1 text-gray-400">→</span>
                  Rule <span className="italic">{ex.ruleName}</span>:{' '}
                  <span className="font-medium text-green-700">{ex.ruleAccountName}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  loading={busy && accept.isPending}
                  disabled={busy}
                  onClick={() => {
                    setPendingId(ex.transactionId);
                    accept.mutate({ transactionId: ex.transactionId, companyId });
                  }}
                >
                  Accept
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy && dismiss.isPending}
                  disabled={busy}
                  onClick={() => {
                    setPendingId(ex.transactionId);
                    dismiss.mutate({ transactionId: ex.transactionId, ruleId: ex.ruleId });
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Bucket 2 — rule-applied items grouped by which rule fired. Build
// plan §2.4 asks for "transactions grouped by rule that fired;
// show rule name + action summary." The per-rule table reuses
// the shared BucketTable with a client-side group filter rather
// than inventing a new render path. Users can expand each group
// to see individual items.
export function RulesBucket({ companyId, period }: Props) {
  const query = useBucket({
    bucket: 'rule',
    companyId,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    limit: 200,
  });

  const groups = useMemo(() => {
    const byRule = new Map<string, { name: string; count: number }>();
    for (const row of query.data?.rows ?? []) {
      const key = row.matchedRuleId ?? 'unknown';
      const name = row.matchedRuleName ?? '(Rule pre-dates tracking)';
      const existing = byRule.get(key);
      if (existing) existing.count += 1;
      else byRule.set(key, { name, count: 1 });
    }
    return Array.from(byRule.entries()).map(([ruleId, { name, count }]) => ({
      ruleId,
      name,
      count,
    }));
  }, [query.data]);

  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <RuleExceptionsSection companyId={companyId} period={period} />
      {query.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No rule-matched items in this period.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group) => {
        const isExpanded = expandedRule === group.ruleId;
        const Chevron = isExpanded ? ChevronDown : ChevronRight;
        return (
          <div key={group.ruleId} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedRule(isExpanded ? null : group.ruleId)}
              className={clsx(
                'flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50',
                isExpanded && 'border-b border-gray-200',
              )}
            >
              <div className="flex items-center gap-2">
                <Chevron className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-900">{group.name}</span>
              </div>
              <span className="text-xs font-medium text-gray-500">{group.count} items</span>
            </button>
            {isExpanded && (
              <div className="p-3">
                {/* BucketTable fetches its own data; we filter by
                    rule id on the client since the endpoint returns
                    only the matched_rule bucket. */}
                <BucketTable
                  bucket="rule"
                  companyId={companyId}
                  period={period}
                  renderRow={(row) =>
                    row.matchedRuleId === group.ruleId ? (
                      <div className="text-xs text-gray-600">
                        Account: {row.suggestedAccountName ?? '—'}
                      </div>
                    ) : null
                  }
                />
              </div>
            )}
          </div>
        );
      })}
        </div>
      )}
    </div>
  );
}
