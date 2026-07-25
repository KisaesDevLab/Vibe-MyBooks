// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

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
  /**
   * Optional page-size dropdown. `pageSize` is the raw selected value ('50', '100',
   * … or 'all'); when provided with `onPageSizeChange`, a "Show: N" select is
   * rendered in the strip. `limit` stays the effective numeric fetch limit.
   */
  pageSize?: string;
  pageSizeOptions?: string[];
  onPageSizeChange?: (size: string) => void;
}

function PageSizeSelect({ pageSize, pageSizeOptions, onPageSizeChange }: Pick<Props, 'pageSize' | 'pageSizeOptions' | 'onPageSizeChange'>) {
  if (!pageSize || !pageSizeOptions || !onPageSizeChange) return null;
  return (
    <label className="inline-flex items-center gap-1.5">
      Show
      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(e.target.value)}
        aria-label="Rows per page"
        className="rounded border border-gray-300 px-2 py-1 text-sm bg-white"
      >
        {pageSizeOptions.map((opt) => (
          <option key={opt} value={opt}>{opt === 'all' ? 'All' : opt}</option>
        ))}
      </select>
    </label>
  );
}

export function Pagination({ total, limit, offset, onChange, unit = 'items', pageSize, pageSizeOptions, onPageSizeChange }: Props) {
  if (total <= limit) {
    // Still show the count so the user knows how many rows match the filter —
    // and keep the page-size dropdown reachable so "All" can be undone.
    return (
      <div className="flex items-center justify-between mt-2 text-sm text-gray-500">
        <span>
          {total} {unit}
        </span>
        <PageSizeSelect pageSize={pageSize} pageSizeOptions={pageSizeOptions} onPageSizeChange={onPageSizeChange} />
      </div>
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
      <div className="flex items-center gap-3">
        <PageSizeSelect pageSize={pageSize} pageSizeOptions={pageSizeOptions} onPageSizeChange={onPageSizeChange} />
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
    </div>
  );
}
