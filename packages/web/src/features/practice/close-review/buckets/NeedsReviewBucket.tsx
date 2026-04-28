// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import type { BucketRow } from '@kis-books/shared';
import { BucketTable } from './BucketTable';
import { VendorEnrichmentPanel } from '../VendorEnrichmentPanel';
import type { ClosePeriod } from '../ClosePeriodSelector';

interface Props {
  companyId: string | null;
  period: ClosePeriod;
}

// Bucket 4 — Needs Review. Build plan §2.4 specifies: row per
// transaction with AI suggestion + top-3 candidates + vendor
// enrichment link. Top-3 candidates come from Phase 3's matcher
// (the state table stores them in `match_candidates`); rendering
// is ready here so Phase 3 can start populating without any UI
// change. Vendor enrichment drawer opens for the focused row.
export function NeedsReviewBucket({ companyId, period }: Props) {
  const [enrichedStateId, setEnrichedStateId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <BucketTable
        bucket="needs_review"
        companyId={companyId}
        period={period}
        renderRow={(row) => (
          <NeedsReviewDetails row={row} onEnrich={() => setEnrichedStateId(row.stateId)} />
        )}
      />
      {enrichedStateId && (
        <div className="fixed inset-x-4 bottom-4 md:inset-x-auto md:right-4 md:w-[420px] z-40">
          <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
              <span className="font-medium">Vendor enrichment</span>
              <button
                type="button"
                onClick={() => setEnrichedStateId(null)}
                className="rounded p-1 hover:bg-gray-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <VendorEnrichmentPanel stateId={enrichedStateId} />
          </div>
        </div>
      )}
    </div>
  );
}

function NeedsReviewDetails({ row, onEnrich }: { row: BucketRow; onEnrich: () => void }) {
  const candidates = row.matchCandidates ?? [];
  const reason = row.reasoning;
  return (
    <div className="flex flex-col gap-1 text-xs">
      {row.suggestedAccountName && (
        <span className="text-gray-800">AI suggestion: {row.suggestedAccountName}</span>
      )}
      {reason?.isNewVendor && (
        <span className="text-rose-700">⚠ New vendor — no categorization history</span>
      )}
      {reason?.isMultiAccountHistory && (
        <span className="text-amber-700">⚠ Past bookings across multiple accounts</span>
      )}
      {candidates.length > 0 && (
        <span className="text-gray-500">
          {candidates.length} potential match{candidates.length === 1 ? '' : 'es'}
        </span>
      )}
      <button
        type="button"
        onClick={onEnrich}
        className="inline-flex w-fit items-center rounded-lg border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
      >
        Vendor info
      </button>
    </div>
  );
}
