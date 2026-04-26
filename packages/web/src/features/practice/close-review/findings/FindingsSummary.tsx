// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import clsx from 'clsx';
import type { FindingSeverity, FindingStatus } from '@kis-books/shared';
import type { FindingsSummary as Summary } from '../../../../api/hooks/useReviewChecks';

interface Props {
  summary: Summary | undefined;
  activeStatus?: FindingStatus | null;
  activeSeverity?: FindingSeverity | null;
  onSeverityClick?: (sev: FindingSeverity | null) => void;
  onStatusClick?: (status: FindingStatus | null) => void;
}

const SEVERITIES: Array<{ key: FindingSeverity; label: string; tone: string }> = [
  { key: 'critical', label: 'Critical', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  { key: 'high', label: 'High', tone: 'bg-orange-50 text-orange-700 border-orange-200' },
  { key: 'med', label: 'Medium', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'low', label: 'Low', tone: 'bg-gray-100 text-gray-700 border-gray-200' },
];

const STATUSES: Array<{ key: FindingStatus; label: string; tone: string }> = [
  { key: 'open', label: 'Open', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  { key: 'assigned', label: 'Assigned', tone: 'bg-blue-50 text-blue-700 border-blue-200' },
  { key: 'in_review', label: 'In review', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  { key: 'resolved', label: 'Resolved', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { key: 'ignored', label: 'Ignored', tone: 'bg-gray-100 text-gray-600 border-gray-200' },
];

// Build plan §7.1: summary widget with severity drill-in. Renders
// two strips of pill-tiles — one per severity, one per status.
// Each tile filters the table on click (clicking the active tile
// clears the filter).
export function FindingsSummary({
  summary,
  activeStatus,
  activeSeverity,
  onSeverityClick,
  onStatusClick,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          By severity
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SEVERITIES.map((s) => {
            const count = summary?.bySeverity[s.key] ?? 0;
            const active = activeSeverity === s.key;
            return (
              <button
                key={s.key}
                type="button"
                disabled={!onSeverityClick}
                onClick={() => onSeverityClick?.(active ? null : s.key)}
                className={clsx(
                  'flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors',
                  s.tone,
                  onSeverityClick && 'hover:border-gray-400 cursor-pointer',
                  active && 'ring-2 ring-offset-1 ring-gray-900',
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider">{s.label}</span>
                <span className="text-xl font-semibold">{count}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          By status
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {STATUSES.map((s) => {
            const count = summary?.byStatus[s.key] ?? 0;
            const active = activeStatus === s.key;
            return (
              <button
                key={s.key}
                type="button"
                disabled={!onStatusClick}
                onClick={() => onStatusClick?.(active ? null : s.key)}
                className={clsx(
                  'flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors',
                  s.tone,
                  onStatusClick && 'hover:border-gray-400 cursor-pointer',
                  active && 'ring-2 ring-offset-1 ring-gray-900',
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider">{s.label}</span>
                <span className="text-xl font-semibold">{count}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
