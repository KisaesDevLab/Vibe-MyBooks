// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Column-header popover for table views, modelled on Vibe Time & Billing's
// (itself on the Canopy layout):
//   Sort A→Z / Sort Z→A
//   [ search values ]
//   Uncheck all              Check all
//   [x] option
//   …
//   [Apply]   Cancel   Clear
//
// Rendered through AnchoredPortal so a table wrapper's overflow-x:auto never
// clips it. The draft (selection + sort) is synced from props only when the
// popover OPENS: a parent re-render mid-edit must not wipe what the user is
// ticking. Nothing is applied until Apply.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnchoredPortal } from './AnchoredPortal';

export type ColumnSortDir = 'asc' | 'desc' | null;

export interface ColumnFilterOption { value: string; label: string }

export interface ColumnFilterProps {
  /** Values to offer. Omit for a sort-only popover (no checkbox list). */
  options?: ColumnFilterOption[];
  selected: ReadonlySet<string>;
  /** This column's sort, or null when it is not the sorted column. */
  sort: ColumnSortDir;
  onApply: (selected: Set<string>, sort: ColumnSortDir) => void;
  /** Hide the sort rows (a filter-only column). Default true. */
  showSort?: boolean;
  /** e.g. { asc: 'Oldest first', desc: 'Newest first' }. Default A→Z / Z→A. */
  sortLabels?: { asc: string; desc: string };
  /** Show the search box. Default: when there are more than 8 options. */
  searchable?: boolean;
  /** e.g. "Filter Status". */
  ariaLabel?: string;
}

export function ColumnFilter({
  options, selected, sort, onApply, showSort = true, sortLabels, searchable, ariaLabel,
}: ColumnFilterProps) {
  const [open, setOpen] = useState(false);
  const [draftSelected, setDraftSelected] = useState<Set<string>>(() => new Set(selected));
  const [draftSort, setDraftSort] = useState<ColumnSortDir>(sort);
  const [query, setQuery] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const hasOptions = !!options && options.length > 0;
  const showSearch = searchable ?? (hasOptions && options!.length > 8);

  // Sync the draft on the open edge only.
  const openPopover = () => {
    setDraftSelected(new Set(selected));
    setDraftSort(sort);
    setQuery('');
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const visible = useMemo(() => {
    if (!options) return [];
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const activeCount = selected.size + (sort ? 1 : 0);

  const apply = () => {
    onApply(new Set(draftSelected), draftSort);
    setOpen(false);
  };
  const clear = () => {
    onApply(new Set(), null);
    setOpen(false);
  };
  const toggleValue = (v: string) => setDraftSelected((prev) => {
    const next = new Set(prev);
    if (next.has(v)) next.delete(v); else next.add(v);
    return next;
  });
  // Check / uncheck all act on the values currently shown by the search.
  const setAllVisible = (on: boolean) => setDraftSelected((prev) => {
    const next = new Set(prev);
    for (const o of visible) { if (on) next.add(o.value); else next.delete(o.value); }
    return next;
  });

  const sortRow = (dir: 'asc' | 'desc', label: string) => (
    <button
      type="button"
      onClick={() => setDraftSort((d) => (d === dir ? null : dir))}
      className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${draftSort === dir ? 'font-medium text-primary-700' : 'text-gray-700'}`}
      aria-pressed={draftSort === dir}
    >
      {label}
      {draftSort === dir && <span className="text-xs">✓</span>}
    </button>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); if (open) setOpen(false); else openPopover(); }}
        aria-label={ariaLabel ?? 'Filter and sort'}
        aria-expanded={open}
        title={ariaLabel ?? 'Filter and sort'}
        className={`relative ml-1 inline-flex h-5 w-5 items-center justify-center rounded hover:bg-gray-200 ${activeCount > 0 ? 'text-primary-700' : 'text-gray-400'}`}
      >
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        {activeCount > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-primary-600 px-1 text-[9px] font-semibold leading-3 text-white">
            {activeCount}
          </span>
        )}
      </button>
      <AnchoredPortal anchorRef={triggerRef} open={open} width={260} maxHeight={420} panelRef={panelRef}
        className="rounded-lg border border-gray-200 bg-white shadow-lg text-sm normal-case tracking-normal font-normal">
        <div role="dialog" aria-label={ariaLabel ?? 'Filter and sort'} onClick={(e) => e.stopPropagation()}>
          {showSort && (
            <div className="border-b border-gray-100 py-1">
              {sortRow('asc', sortLabels?.asc ?? 'Sort A → Z')}
              {sortRow('desc', sortLabels?.desc ?? 'Sort Z → A')}
            </div>
          )}
          {hasOptions && (
            <div className="py-1">
              {showSearch && (
                <div className="px-3 py-1.5">
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search values…"
                    aria-label="Search values"
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
              )}
              <div className="flex items-center justify-between px-3 py-1 text-xs">
                <button type="button" onClick={() => setAllVisible(false)} className="text-gray-500 hover:text-gray-800">Uncheck all</button>
                <button type="button" onClick={() => setAllVisible(true)} className="text-gray-500 hover:text-gray-800">Check all</button>
              </div>
              <ul className="max-h-48 overflow-y-auto px-1">
                {visible.length === 0 && <li className="px-2 py-1.5 text-xs text-gray-400">No matches</li>}
                {visible.map((o) => (
                  <li key={o.value}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={draftSelected.has(o.value)}
                        onChange={() => toggleValue(o.value)}
                        className="rounded border-gray-300"
                      />
                      <span className="truncate text-gray-800">{o.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex items-center gap-3 border-t border-gray-100 px-3 py-2">
            <button type="button" onClick={apply} className="rounded bg-primary-600 px-3 py-1 text-sm font-medium text-white hover:bg-primary-700">Apply</button>
            <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-600 hover:text-gray-900">Cancel</button>
            <button type="button" onClick={clear} className="ml-auto text-sm text-gray-500 hover:text-gray-800">Clear</button>
          </div>
        </div>
      </AnchoredPortal>
    </>
  );
}
