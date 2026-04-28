// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { DUPLICATE_WARNING_DELTA, type BucketRow, type MatchCandidate } from '@kis-books/shared';
import { useBucket } from '../../../../api/hooks/useClassificationState';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { MatchCandidateCard } from './MatchCandidateCard';
import type { ClosePeriod } from '../ClosePeriodSelector';

interface Props {
  companyId: string | null;
  period: ClosePeriod;
}

// Bucket 1 — Potential Matches against existing ledger items
// (invoices, bills, JEs, transfers, recurring schedules). Each
// row in the bucket renders the bank-feed item header plus a
// stack of MatchCandidateCard components for its top-3
// candidates. The default BucketTable layout doesn't fit here —
// its single-row table can't host the candidate stack — so this
// bucket renders directly.
export function PotentialMatchesBucket({ companyId, period }: Props) {
  const query = useBucket({
    bucket: 'potential_match',
    companyId,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    limit: 100,
  });

  if (query.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const rows = query.data?.rows ?? [];
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
        No potential matches in this period. New bank-feed items get matched against open invoices, bills, journal entries, transfers, and upcoming recurring templates as they're ingested.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row) => (
        <FeedItemWithCandidates key={row.stateId} row={row} />
      ))}
    </div>
  );
}

function FeedItemWithCandidates({ row }: { row: BucketRow }) {
  const candidates = (row.matchCandidates ?? []) as MatchCandidate[];
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const feedAmount = parseFloat(row.amount);
  const top = candidates[0];

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between bg-gray-50 px-4 py-2 border-b border-gray-200">
        <div className="flex items-center gap-3 text-sm">
          <span className="font-medium text-gray-900">{row.description}</span>
          <span className="text-xs text-gray-500">{row.feedDate}</span>
        </div>
        <span className="text-sm font-mono text-gray-900">{fmt.format(feedAmount)}</span>
      </div>
      <div className="p-3 grid gap-2 md:grid-cols-2">
        {candidates.map((c, i) => {
          // Duplicate-warning rule: this candidate is within
          // DUPLICATE_WARNING_DELTA of the top candidate's score
          // (and isn't itself the top candidate).
          const dup =
            !!top && i > 0 && Math.abs(top.score - c.score) <= DUPLICATE_WARNING_DELTA;
          return (
            <MatchCandidateCard
              key={`${c.kind}-${c.targetId}-${i}`}
              stateId={row.stateId}
              candidateIndex={i}
              candidate={c}
              feedAmount={feedAmount}
              duplicateWarning={dup}
            />
          );
        })}
      </div>
    </div>
  );
}
