// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { Activity, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ConditionalRuleStats } from '@kis-books/shared';
import { useRuleAudit } from '../../../../api/hooks/useRuleAudit';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { Button } from '../../../../components/ui/Button';

interface Props {
  ruleId: string | null;
  stats: ConditionalRuleStats | null;
}

// Phase 5b §5.6 — stats panel + paginated audit log inside the
// rule editor modal. The summary stats come from the parent
// (already loaded with the rules list); the audit log paginates
// independently via cursor.
export function StatsTab({ ruleId, stats }: Props) {
  const [cursorStack, setCursorStack] = useState<Array<string | null>>([undefined as unknown as string | null]);
  const currentCursor = cursorStack[cursorStack.length - 1] ?? undefined;
  const { data: audit, isLoading } = useRuleAudit(ruleId, currentCursor ?? undefined);

  if (!ruleId) {
    return (
      <p className="text-sm text-gray-500 italic">
        Save the rule to start collecting stats. Stats are computed from per-fire audit rows.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section>
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-900">Summary</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tile label="Total fires" value={stats?.firesTotal ?? 0} />
          <Tile label="Last 30 days" value={stats?.fires30d ?? 0} />
          <Tile label="Last 7 days" value={stats?.fires7d ?? 0} />
          <Tile
            label="Override rate"
            value={
              stats?.overrideRate === null || stats?.overrideRate === undefined
                ? '—'
                : `${Math.round(stats.overrideRate * 100)}%`
            }
            tone={stats?.overrideRate && stats.overrideRate > 0.2 ? 'amber' : 'gray'}
          />
        </div>
        {stats?.lastFiredAt && (
          <div className="mt-2 text-xs text-gray-500">
            Last fired: {new Date(stats.lastFiredAt).toLocaleString()}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-2">
          <History className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-900">Audit log</h3>
        </div>
        {isLoading ? (
          <LoadingSpinner size="sm" />
        ) : !audit || audit.rows.length === 0 ? (
          <p className="text-xs italic text-gray-500">No fires recorded yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr className="text-left uppercase tracking-wider text-gray-500">
                  <th className="px-3 py-1.5">Matched at</th>
                  <th className="px-3 py-1.5">Feed item / Txn</th>
                  <th className="px-3 py-1.5">Actions</th>
                  <th className="px-3 py-1.5">Overridden?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {audit.rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-1.5 font-mono text-gray-700">
                      {new Date(row.matchedAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-1.5 text-gray-700 font-mono">
                      {row.transactionId ? (
                        <Link to={`/transactions/${row.transactionId}`} className="text-indigo-600 hover:underline">
                          {row.transactionId.slice(0, 8)}…
                        </Link>
                      ) : row.bankFeedItemId ? (
                        <span>{row.bankFeedItemId.slice(0, 8)}…</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-gray-700">
                      {row.actionsApplied?.map((a) => a.type).join(', ') ?? '—'}
                    </td>
                    <td className="px-3 py-1.5">
                      {row.wasOverridden ? (
                        <span className="text-amber-700">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-end gap-2 mt-2">
          <Button
            variant="secondary"
            disabled={cursorStack.length <= 1}
            onClick={() => setCursorStack((s) => s.slice(0, -1))}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            disabled={!audit?.nextCursor}
            onClick={() => setCursorStack((s) => [...s, audit?.nextCursor ?? null])}
          >
            Next
          </Button>
        </div>
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  tone = 'gray',
}: {
  label: string;
  value: number | string;
  tone?: 'gray' | 'amber';
}) {
  const colors = tone === 'amber'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : 'border-gray-200 bg-white text-gray-900';
  return (
    <div className={`rounded-lg border p-3 ${colors}`}>
      <div className="text-[11px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}
