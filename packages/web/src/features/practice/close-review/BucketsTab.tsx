// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Landmark } from 'lucide-react';
import type { ClassificationBucket } from '@kis-books/shared';
import type { FeedReviewSummary } from '../../../api/hooks/useClassificationState';
import { BucketSummaryRow } from './BucketSummaryRow';
import { PotentialMatchesBucket } from './buckets/PotentialMatchesBucket';
import { RulesBucket } from './buckets/RulesBucket';
import { AutoClassificationsBucket } from './buckets/AutoClassificationsBucket';
import { NeedsReviewBucket } from './buckets/NeedsReviewBucket';
import { FeedReviewSection } from './FeedReviewSection';
import { periodForMonth, type ClosePeriod } from './ClosePeriodSelector';
import type { BucketSummary } from '@kis-books/shared';

interface Props {
  companyId: string | null;
  period: ClosePeriod;
  summary: BucketSummary | undefined;
  feedReview: FeedReviewSummary | undefined;
  onChangePeriod: (next: ClosePeriod) => void;
  onOpenReview: () => void;
}

type ActiveBucket = Exclude<ClassificationBucket, 'auto_medium'>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

// Bank feed tab. Two passes over the period's bank transactions:
//   1. Still to categorize — the bucket workflow (only while anything is
//      uncategorized; usually empty by close time because the categorizing
//      happens on the Banking screen).
//   2. Review what was categorized — the reviewer pass (FeedReviewSection).
// A client with no bank feed at all gets an explanation instead of empty
// tiles, and uncategorized items in OTHER months get a banner so they are
// not hidden by the period picker.
export function BucketsTab({ companyId, period, summary, feedReview, onChangePeriod, onOpenReview }: Props) {
  const [active, setActive] = useState<ActiveBucket>('needs_review');

  if (feedReview && !feedReview.hasBankFeed) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
        <Landmark className="h-8 w-8 text-gray-400" />
        <div className="text-sm font-semibold text-gray-900">This client has no bank feed</div>
        <p className="max-w-lg text-sm text-gray-600">
          There is no connected bank and no imported bank statement, so there is nothing to categorize or review
          here. The books are entered some other way (journal entries or an import) — review them with the
          review checks instead.
        </p>
        <button
          type="button"
          onClick={onOpenReview}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Go to Review
        </button>
      </div>
    );
  }

  const openInPeriod = (summary?.totalUncategorized ?? 0) + (feedReview?.periodOpen ?? 0) > 0;
  const otherMonths = feedReview?.otherMonthsOpen ?? [];

  return (
    <div className="flex flex-col gap-4">
      {otherMonths.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span>Still uncategorized in other months:</span>
          {otherMonths.map((m) => (
            <button
              key={m.month}
              type="button"
              onClick={() => {
                const [y, mo] = m.month.split('-').map(Number);
                onChangePeriod(periodForMonth(y!, (mo ?? 1) - 1));
              }}
              className="rounded-full border border-amber-300 bg-white px-2.5 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              {monthLabel(m.month)} ({m.count})
            </button>
          ))}
        </div>
      )}

      {openInPeriod ? (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Still to categorize</h3>
          <BucketSummaryRow
            summary={summary}
            activeBucket={active === 'auto_high' ? 'auto_high' : active}
            onBucketClick={(bucket) => {
              // auto_medium shares the Bucket 3 view with auto_high
              setActive(bucket === 'auto_medium' ? 'auto_high' : (bucket as ActiveBucket));
            }}
          />
          {active === 'potential_match' && <PotentialMatchesBucket companyId={companyId} period={period} />}
          {active === 'rule' && <RulesBucket companyId={companyId} period={period} />}
          {active === 'auto_high' && (
            <AutoClassificationsBucket companyId={companyId} period={period} summary={summary} />
          )}
          {active === 'needs_review' && <NeedsReviewBucket companyId={companyId} period={period} />}
        </section>
      ) : feedReview ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          {feedReview.periodTotal === 0
            ? `No bank transactions dated in ${period.label}.`
            : `Nothing left to categorize in ${period.label} — all ${feedReview.periodTotal} bank transactions are categorized, matched or excluded.`}
        </div>
      ) : null}

      {feedReview && feedReview.doneTotal > 0 && (
        <FeedReviewSection companyId={companyId} period={period} summary={feedReview} />
      )}
    </div>
  );
}
