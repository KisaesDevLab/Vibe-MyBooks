// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { useBucket } from '../../../../api/hooks/useClassificationState';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { BucketTable } from './BucketTable';
import type { ClosePeriod } from '../ClosePeriodSelector';

interface Props {
  companyId: string | null;
  period: ClosePeriod;
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

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
        No rule-matched items in this period.
      </div>
    );
  }

  return (
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
  );
}
