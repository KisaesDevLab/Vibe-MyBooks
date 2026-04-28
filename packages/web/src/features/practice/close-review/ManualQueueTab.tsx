// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Link } from 'react-router-dom';
import { ListChecks, ExternalLink } from 'lucide-react';
import { useCompanyContext } from '../../../providers/CompanyProvider';
import { useManualQueue, type ManualQueueRow } from '../../../api/hooks/useManualQueue';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import type { ClosePeriod } from './ClosePeriodSelector';

interface Props {
  period: ClosePeriod;
}

const REASON_LABEL: Record<ManualQueueRow['reason'], { label: string; tone: string }> = {
  orphan: {
    label: 'No classification result',
    tone: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  no_suggestion: {
    label: 'AI could not suggest',
    tone: 'bg-amber-50 text-amber-700 border-amber-200',
  },
};

// Build plan §2.1 manual queue: bank-feed items the system could
// not auto-classify and that need a human to pick an account.
// Two sources land here — orphans (worker hasn't reached them yet
// or it errored) and items the worker classified as needs_review
// but couldn't suggest anything for. Each row deep-links into the
// Bank Feed where the bookkeeper can categorize directly.
export function ManualQueueTab({ period }: Props) {
  const { activeCompanyId } = useCompanyContext();
  const queryResult = useManualQueue({
    companyId: activeCompanyId ?? null,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  });

  if (queryResult.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const rows = queryResult.data?.rows ?? [];
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
        <ListChecks className="mx-auto h-8 w-8 text-gray-400" />
        <h2 className="mt-3 text-sm font-semibold text-gray-900">Manual queue is clear</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
          Every bank-feed item in this period has either been categorized or has an
          AI-generated suggestion. Items that the system can't classify will land here.
        </p>
      </div>
    );
  }

  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <strong>{rows.length}</strong> {rows.length === 1 ? 'item is' : 'items are'} waiting for
        you to pick an account or vendor manually. Click "Open in Bank Feed" to categorize.
      </div>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2 w-40">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => {
              const reason = REASON_LABEL[row.reason];
              return (
                <tr key={row.bankFeedItemId}>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">{row.feedDate}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {row.description || '(no description)'}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-gray-900">
                    {fmt.format(parseFloat(row.amount))}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${reason.tone}`}
                    >
                      {reason.label}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      to={`/banking/feed?focus=${row.bankFeedItemId}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open in Bank Feed
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
