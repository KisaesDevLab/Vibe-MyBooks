// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState, useRef, useEffect, useLayoutEffect, useCallback, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

export interface DropdownOption {
  id: string;
  // `label` is the selected-input display text and the search haystack.
  label: string;
  // Right-aligned muted badge on line 1 (e.g. account type).
  sublabel?: string;
  // Two-line list rendering: when set, the list shows `title` on line 1 and
  // `description` on line 2 (instead of `label` on a single truncated line).
  // The input still shows `label`. Consumers that omit these render single-line.
  title?: string;
  description?: string;
  group?: string;
}

interface SearchableDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
  onAddNew?: (searchText: string) => void;
  addNewLabel?: string;
  compact?: boolean;
  // Server-side search hook: called whenever the user's query text
  // changes (and with '' on close/select), so the parent can feed it
  // into a search-backed list query instead of relying on the
  // client-side filter over a capped page of options.
  onQueryChange?: (query: string) => void;
  // Fallback display label for the selected id when it isn't among
  // `options` (e.g. a saved value outside the current server page).
  selectedLabel?: string;
  // Grid/spreadsheet navigation. When provided, choosing an option (via
  // Enter or click) advances focus to the next cell instead of blurring
  // the input, and Tab / Shift+Tab route through the same handler so a
  // parent grid can move focus cell-to-cell. `dataCell` stamps the input
  // with a `data-cell` coordinate the grid can target with `.focus()`.
  onNavigate?: (dir: 'next' | 'prev') => void;
  dataCell?: string;
}

export function SearchableDropdown({ value, onChange, options, placeholder = 'Search...', label, required, className, onAddNew, addNewLabel, compact, onQueryChange, selectedLabel, onNavigate, dataCell }: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Fixed-position rect for the portal-rendered panel. The panel lives on
  // document.body (not inside this `relative` wrapper) so a modal/scroll
  // container's `overflow` can never clip it and z-index always wins.
  const [panelPos, setPanelPos] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);

  const updatePanelPos = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const GAP = 4;
    const cap = compact ? 192 : 240; // matches max-h-48 / max-h-60
    const spaceBelow = window.innerHeight - r.bottom - GAP - 8;
    const spaceAbove = r.top - GAP - 8;
    // Flip above when there's clearly more room up top.
    const openUp = spaceBelow < Math.min(cap, 160) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(cap, openUp ? spaceAbove : spaceBelow));
    setPanelPos({
      left: r.left,
      width: r.width,
      maxHeight,
      top: openUp ? r.top - GAP - maxHeight : r.bottom + GAP,
    });
  }, [compact]);

  // Position on open, and keep it pinned to the input while any ancestor
  // scrolls (capture=true) or the window resizes.
  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePanelPos();
    const onScroll = () => updatePanelPos();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [isOpen, updatePanelPos]);

  // Derive display value from selected id; fall back to the caller-
  // supplied label when the selection isn't in the current option page.
  const selectedOption = options.find((o) => o.id === value);
  const displayValue = isOpen ? search : (selectedOption?.label || selectedLabel || '');

  const setSearchAndNotify = (q: string) => {
    setSearch(q);
    onQueryChange?.(q);
  };

  // Filter options by search
  const query = search.toLowerCase();
  const filtered = query
    ? options.filter((o) =>
        o.label.toLowerCase().includes(query) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(query)),
      )
    : options;

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightIndex(0);
  }, [search]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const el = listRef.current.children[highlightIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex, isOpen]);

  // Close on outside click. The panel now lives in a portal on document.body,
  // so "outside" must exclude BOTH the input wrapper and the portal panel —
  // otherwise a mousedown on an option counts as outside and closes the panel
  // before the option's click handler fires.
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inWrapper = wrapperRef.current?.contains(target) ?? false;
      const inPanel = listRef.current?.contains(target) ?? false;
      if (!inWrapper && !inPanel) {
        setIsOpen(false);
        setSearchAndNotify('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearchAndNotify('');
    // In a grid, hand focus to the next cell so entry keeps flowing
    // (the reported "hit Enter to pick an account and it loses focus"
    // bug). Standalone forms keep the original blur-on-select behavior.
    if (onNavigate) onNavigate('next');
    else inputRef.current?.blur();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      setIsOpen(true);
      return;
    }

    // Grid nav: Tab must move to the adjacent cell even when the panel is
    // closed (e.g. after Escape) — otherwise browser default lands focus on
    // the ✕ clear button instead of the next cell.
    if (!isOpen && e.key === 'Tab' && onNavigate) {
      e.preventDefault();
      onNavigate(e.shiftKey ? 'prev' : 'next');
      return;
    }

    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        e.stopPropagation();
        if (filtered[highlightIndex]) {
          handleSelect(filtered[highlightIndex].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchAndNotify('');
        break;
      case 'Tab':
        setIsOpen(false);
        setSearchAndNotify('');
        // Route Tab through the grid's cell navigation when wired up so
        // focus skips the clear button and lands on the adjacent cell.
        if (onNavigate) {
          e.preventDefault();
          onNavigate(e.shiftKey ? 'prev' : 'next');
        }
        break;
    }
  };

  return (
    <div className={clsx('relative', className)} ref={wrapperRef}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        placeholder={placeholder}
        required={required && !value}
        onChange={(e) => {
          setSearchAndNotify(e.target.value);
          if (!isOpen) setIsOpen(true);
          if (e.target.value === '') onChange('');
        }}
        onFocus={() => {
          setIsOpen(true);
          setSearchAndNotify('');
        }}
        onKeyDown={handleKeyDown}
        className={clsx(
          'block w-full border focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500',
          compact
            ? 'rounded px-1.5 py-1 text-xs border-gray-300'
            : 'rounded-lg px-3 py-2 text-sm border-gray-300',
          value ? 'text-gray-900' : 'text-gray-500',
        )}
        autoComplete="off"
      />

      {/* Clear button */}
      {value && !isOpen && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(''); setSearch(''); inputRef.current?.focus(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
          style={label ? { top: 'calc(50% + 10px)' } : undefined}
        >
          ✕
        </button>
      )}

      {/* Dropdown list — rendered in a portal with fixed positioning so it is
          never clipped by an ancestor's overflow (modals, scroll containers)
          and always stacks above them. */}
      {isOpen && panelPos && createPortal(
        <div
          className={clsx('fixed z-[1000] bg-white border border-gray-200 shadow-lg overflow-auto', compact ? 'rounded' : 'rounded-lg')}
          style={{ left: panelPos.left, top: panelPos.top, width: panelPos.width, maxHeight: panelPos.maxHeight }}
          ref={listRef}
        >
          {filtered.length === 0 && !onAddNew && (
            <div className={clsx('text-gray-400', compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2 text-sm')}>No matches found</div>
          )}
          {filtered.map((option, idx) => (
            <div
              key={option.id}
              onClick={() => handleSelect(option.id)}
              onMouseEnter={() => setHighlightIndex(idx)}
              className={clsx(
                'cursor-pointer',
                compact ? 'px-2 py-1.5 text-xs' : 'px-3 py-2.5 text-sm',
                idx === highlightIndex ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-50',
                option.id === value && 'font-medium',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{option.title ?? option.label}</span>
                {option.sublabel && (
                  <span className={clsx('text-gray-400 flex-shrink-0', compact ? 'text-[10px]' : 'text-xs')}>{option.sublabel}</span>
                )}
              </div>
              {option.description && (
                <div className={clsx('truncate text-gray-500 mt-0.5', compact ? 'text-[10px]' : 'text-xs')}>
                  {option.description}
                </div>
              )}
            </div>
          ))}
          {onAddNew && (
            <div
              onClick={() => { onAddNew(search); setIsOpen(false); setSearch(''); }}
              className={clsx(
                'cursor-pointer border-t border-gray-100 text-primary-600 font-medium hover:bg-primary-50 flex items-center gap-1.5',
                compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm',
              )}
            >
              <span className="leading-none">+</span>
              {addNewLabel || (search ? `Add "${search}"` : 'Add new...')}
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
