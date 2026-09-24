// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// A table header cell that sorts its column. Same look as the transaction
// list's header (▲ ▼ ↕), typed on the caller's own key union so a page can
// only ask for sorts its endpoint whitelists.
//
// Optionally carries a ColumnFilter popover (the ▾ beside the label): pass
// `filter` for a value checklist, and/or `onSortDir` so the popover's
// Sort A→Z / Z→A rows can set an explicit direction. Callers that pass
// neither get exactly the plain header they always had.

import { ColumnFilter, type ColumnFilterOption, type ColumnSortDir } from './ColumnFilter';

export interface SortableThFilter {
  options: ColumnFilterOption[];
  selected: ReadonlySet<string>;
  onApply: (selected: Set<string>) => void;
  searchable?: boolean;
  sortLabels?: { asc: string; desc: string };
  ariaLabel?: string;
}

export function SortableTh<K extends string>({
  sortKey, label, align, sortBy, sortDir, onSort, onSortDir, filter, className = '', padding = 'px-3 py-2',
}: {
  sortKey: K;
  label: string;
  align?: 'left' | 'right' | 'center';
  sortBy: '' | K;
  sortDir: 'asc' | 'desc';
  onSort: (k: K) => void;
  /** Explicit direction from the popover's sort rows. */
  onSortDir?: (k: K, dir: 'asc' | 'desc') => void;
  /** Value filter for this column; renders the ▾ popover. */
  filter?: SortableThFilter;
  /** Extra classes on the <th> (widths, min widths). */
  className?: string;
  /** Cell padding, to match the table's other header cells. Default px-3 py-2. */
  padding?: string;
}) {
  const active = sortBy === sortKey;
  const text = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const ariaSort = active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none';
  const popover = filter || onSortDir;
  return (
    <th className={`${padding} ${text} ${className}`} aria-sort={ariaSort} data-col={sortKey}>
      <span className={`inline-flex items-center ${align === 'right' ? 'flex-row-reverse' : ''}`}>
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
        {popover && (
          <ColumnFilter
            options={filter?.options}
            selected={filter?.selected ?? EMPTY}
            sort={active ? sortDir : null}
            showSort={!!onSortDir}
            sortLabels={filter?.sortLabels}
            searchable={filter?.searchable}
            ariaLabel={filter?.ariaLabel ?? `Filter ${label}`}
            onApply={(sel: Set<string>, dir: ColumnSortDir) => {
              filter?.onApply(sel);
              if (dir && onSortDir) onSortDir(sortKey, dir);
            }}
          />
        )}
      </span>
    </th>
  );
}

const EMPTY: ReadonlySet<string> = new Set();
