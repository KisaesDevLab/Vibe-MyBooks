// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.
//
// ADR 0XZ §2.2 — single-select tag picker intended for the per-line
// slot on <SplitRowV2>. The multi-select <TagSelector> is still used
// at the transaction header in legacy layouts; this picker is specific
// to line-level entry where one logical split carries at most one tag.

import { useState, useRef, useEffect } from 'react';
import { useTags } from '../../../api/hooks/useTags';
import clsx from 'clsx';
import { ChevronDown, X } from 'lucide-react';

export interface LineTagPickerProps {
  /** Current tag id on the line. Null means "untagged" (which is valid). */
  value: string | null;
  /** Fires on every user interaction with the picker, including explicit clear.
   *  The second argument is `true` whenever the user directly interacted with
   *  the field — parent forms use it to set the `userHasTouchedTag` flag per
   *  ADR 0XY §4 so default-tag recomputation does not overwrite user intent. */
  onChange: (tagId: string | null, userTouched: boolean) => void;
  /** Accessible label. Defaults to "Tag". */
  ariaLabel?: string;
  /** Width class for the picker trigger. Tailwind utility. */
  className?: string;
  /** When true, render a compact picker suitable for dense entry grids. */
  compact?: boolean;
}

export function LineTagPicker({
  value,
  onChange,
  ariaLabel = 'Tag',
  className,
  compact = false,
}: LineTagPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { data } = useTags({ isActive: true });
  const tags = data?.tags || [];

  const selected = tags.find((t) => t.id === value) || null;
  const filtered = search
    ? tags.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()))
    : tags;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const choose = (tagId: string) => {
    onChange(tagId, true);
    setIsOpen(false);
    setSearch('');
  };

  const clear = () => {
    onChange(null, true);
    setIsOpen(false);
    setSearch('');
  };

  // Vertical padding matches the standard input / selector height
  // (py-2 + text-sm) whether or not `compact` is set — mixing a
  // shorter tag button next to py-2 fields looked visually off. The
  // compact prop now only tightens horizontal padding and rounds the
  // corners a hair less, keeping the line height flush with siblings.
  const sizeClasses = compact
    ? 'text-sm py-2 px-2 rounded'
    : 'text-sm py-2 px-3 rounded-lg';

  return (
    <div ref={wrapperRef} className={clsx('relative', className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        className={clsx(
          'flex items-center justify-between w-full border border-gray-300 bg-white hover:border-gray-400',
          sizeClasses,
        )}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {selected ? (
            <>
              {selected.color && (
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selected.color }}
                />
              )}
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <span className="text-gray-400">Tag…</span>
          )}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 ml-1" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute z-20 mt-1 w-56 max-h-64 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
        >
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tags…"
            className="w-full border-b border-gray-100 px-3 py-1.5 text-xs focus:outline-none"
          />
          {value && (
            <button
              type="button"
              onClick={clear}
              className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              <X className="h-3 w-3" /> Clear
            </button>
          )}
          {filtered.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-500">No tags match.</div>
          )}
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              role="option"
              aria-selected={value === t.id}
              onClick={() => choose(t.id)}
              className={clsx(
                'flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50',
                value === t.id && 'bg-primary-50 text-primary-900',
              )}
            >
              {t.color && (
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
              )}
              <span className="truncate">{t.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
