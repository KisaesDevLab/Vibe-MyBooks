// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMemo } from 'react';
import clsx from 'clsx';
import type { CheckRegistryEntry, Finding } from '@kis-books/shared';
import { SeverityBadge } from './SeverityBadge';
import { StatusBadge } from './StatusBadge';

interface Props {
  rows: Finding[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onRowClick: (f: Finding) => void;
  registry: CheckRegistryEntry[];
}

// Build plan §7.2 table layout: severity, check, context, age,
// status, assignee. Bulk-select via header checkbox + per-row
// checkbox. Row click opens the detail drawer (handled by parent
// via onRowClick).
export function FindingsTable({
  rows,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onRowClick,
  registry,
}: Props) {
  const checkNameByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of registry) m.set(r.checkKey, r.name);
    return m;
  }, [registry]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
            <th className="px-3 py-2 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                aria-label="Select all"
              />
            </th>
            <th className="px-3 py-2 w-24">Severity</th>
            <th className="px-3 py-2">Check</th>
            <th className="px-3 py-2">Context</th>
            <th className="px-3 py-2 w-24">Age</th>
            <th className="px-3 py-2 w-28">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => {
            const isSelected = selected.has(row.id);
            return (
              <tr
                key={row.id}
                onClick={() => onRowClick(row)}
                className={clsx(
                  'cursor-pointer hover:bg-gray-50',
                  isSelected && 'bg-indigo-50',
                )}
              >
                <td
                  className="px-3 py-2"
                  onClick={(e) => {
                    // Stop the row click from firing when the user
                    // toggles the checkbox.
                    e.stopPropagation();
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(row.id)}
                    aria-label={`Select finding ${row.id}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <SeverityBadge severity={row.severity} />
                </td>
                <td className="px-3 py-2">
                  <span className="font-medium text-gray-900">
                    {checkNameByKey.get(row.checkKey) ?? row.checkKey}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-700">
                  <ContextSummary finding={row} />
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {formatAge(row.createdAt)}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Renders a one-liner from the finding's payload — every check
// stuffs its identifying detail in there. Falls back to the
// transaction or vendor id when no specific field is present.
function ContextSummary({ finding }: { finding: Finding }) {
  const p = (finding.payload ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof p['description'] === 'string') parts.push(p['description'] as string);
  if (typeof p['vendorName'] === 'string') parts.push(p['vendorName'] as string);
  if (typeof p['accountName'] === 'string') parts.push(`→ ${p['accountName']}`);
  if (typeof p['amount'] === 'number') {
    const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    parts.push(fmt.format(p['amount'] as number));
  }
  if (typeof p['date'] === 'string') parts.push(p['date'] as string);
  if (parts.length === 0 && finding.transactionId) parts.push(`txn ${finding.transactionId.slice(0, 8)}…`);
  if (parts.length === 0 && finding.vendorId) parts.push(`vendor ${finding.vendorId.slice(0, 8)}…`);
  if (parts.length === 0) parts.push('—');
  return <span className="text-xs">{parts.join(' · ')}</span>;
}

function formatAge(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}
