// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ExternalLink, Landmark } from 'lucide-react';
import type { FeedReviewSummary } from '../../../api/hooks/useClassificationState';
import { FeedReviewSection } from './FeedReviewSection';
import { periodForMonth, type ClosePeriod } from './ClosePeriodSelector';

interface Props {
  companyId: string | null;
  period: ClosePeriod;
  feedReview: FeedReviewSummary | undefined;
  onChangePeriod: (next: ClosePeriod) => void;
  onOpenReview: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

// Bank feed tab — the reviewer pass over the month's bank transactions.
// Categorizing itself happens on Banking → Bank feed; while anything in the
// month is still uncategorized this tab says how many and links there with
// the month pre-filtered. A client with no bank feed at all gets an
// explanation instead, and uncategorized items in OTHER months get a banner
// so they are not hidden by the period picker.
export function BucketsTab({ companyId, period, feedReview, onChangePeriod, onOpenReview }: Props) {
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

  const openInPeriod = feedReview?.periodOpen ?? 0;
  const otherMonths = feedReview?.otherMonthsOpen ?? [];
  // Banking's date filter is inclusive: first to last day of the month.
  const from = period.periodStart.slice(0, 10);
  const to = new Date(new Date(period.periodEnd).getTime() - 86_400_000).toISOString().slice(0, 10);

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

      {openInPeriod > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <span>
            <span className="font-semibold">{openInPeriod} bank transaction{openInPeriod === 1 ? '' : 's'}</span>{' '}
            in {period.label} still need{openInPeriod === 1 ? 's' : ''} categorizing.
          </span>
          <Link
            to={`/banking/feed?from=${from}&to=${to}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-rose-800 ring-1 ring-rose-200 hover:bg-rose-100"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open in Banking
          </Link>
        </div>
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
