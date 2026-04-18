// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { ChevronLeft, ChevronRight } from 'lucide-react';

// Reusable pagination strip for list pages backed by a limit/offset API.
// Previously the list pages hardcoded `offset: 0` with no next/prev, which
// silently truncated tenants with >50 rows.

interface Props {
  total: number;
  limit: number;
  offset: number;
  onChange: (nextOffset: number) => void;
  unit?: string;
}

export function Pagination({ total, limit, offset, onChange, unit = 'items' }: Props) {
  if (total <= limit) {
    // Still show the count so the user knows how many rows match the filter.
    return (
      <p className="text-sm text-gray-500 mt-2">
        {total} {unit}
      </p>
    );
  }

  const page = Math.floor(offset / limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const canPrev = offset > 0;
  const canNext = offset + limit < total;
  const rangeStart = total === 0 ? 0 : offset + 1;
  const rangeEnd = Math.min(offset + limit, total);

  return (
    <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
      <span>
        Showing {rangeStart}-{rangeEnd} of {total} {unit}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onChange(Math.max(0, offset - limit))}
          aria-label="Previous page"
          className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <span className="tabular-nums">
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onChange(offset + limit)}
          aria-label="Next page"
          className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
