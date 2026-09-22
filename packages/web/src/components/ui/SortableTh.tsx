// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// A table header cell that sorts its column. Same look as the transaction
// list's header (▲ ▼ ↕), typed on the caller's own key union so a page can
// only ask for sorts its endpoint whitelists.

export function SortableTh<K extends string>({
  sortKey, label, align, sortBy, sortDir, onSort, className = '',
}: {
  sortKey: K;
  label: string;
  align?: 'left' | 'right' | 'center';
  sortBy: '' | K;
  sortDir: 'asc' | 'desc';
  onSort: (k: K) => void;
  /** Extra classes on the <th> (widths, min widths). */
  className?: string;
}) {
  const active = sortBy === sortKey;
  const text = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const ariaSort = active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
  return (
    <th className={`px-3 py-2 ${text} ${className}`} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={active ? `Sorted ${sortDir === 'asc' ? 'ascending' : 'descending'}. Click to flip.` : `Sort by ${label}`}
        className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-gray-700 ${active ? 'text-gray-800' : ''}`}
      >
        {label}
        <span className="text-[10px] leading-none" aria-hidden="true">
          {active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}
