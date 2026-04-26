// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import clsx from 'clsx';
import type { BucketRow, BucketSummary } from '@kis-books/shared';
import { BucketTable } from './BucketTable';
import type { ClosePeriod } from '../ClosePeriodSelector';

interface Props {
  companyId: string | null;
  period: ClosePeriod;
  summary: BucketSummary | undefined;
}

type SubTab = 'high' | 'medium';

// Bucket 3 — Auto Classifications with High / Medium sub-tabs.
// Each sub-tab drives a separate BucketTable. Sub-tab counts read
// the summary the parent already fetched so we don't duplicate
// the /summary request inside this surface.
export function AutoClassificationsBucket({ companyId, period, summary }: Props) {
  const [sub, setSub] = useState<SubTab>('high');
  const highCount = summary?.buckets.auto_high ?? 0;
  const mediumCount = summary?.buckets.auto_medium ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-1 border-b border-gray-200">
        <TabButton
          active={sub === 'high'}
          onClick={() => setSub('high')}
          label="High confidence"
          count={highCount}
        />
        <TabButton
          active={sub === 'medium'}
          onClick={() => setSub('medium')}
          label="Medium confidence"
          count={mediumCount}
        />
      </div>
      <BucketTable
        bucket={sub === 'high' ? 'auto_high' : 'auto_medium'}
        companyId={companyId}
        period={period}
        renderRow={(row) => <ConfidenceBadge row={row} />}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        '-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'border-indigo-600 text-indigo-700'
          : 'border-transparent text-gray-500 hover:text-gray-700',
      )}
    >
      {label}
      <span
        className={clsx(
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs',
          active ? 'bg-indigo-50 text-indigo-700' : 'bg-gray-100 text-gray-600',
        )}
      >
        {count}
      </span>
    </button>
  );
}

function ConfidenceBadge({ row }: { row: BucketRow }) {
  const pct = Math.round(row.confidenceScore * 100);
  const tone = row.bucket === 'auto_high' ? 'emerald' : 'amber';
  return (
    <div className="flex flex-col gap-1">
      <span
        className={clsx(
          'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium',
          tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700',
        )}
      >
        {pct}% confident
      </span>
      {row.suggestedAccountName && (
        <span className="text-xs text-gray-600">→ {row.suggestedAccountName}</span>
      )}
    </div>
  );
}
