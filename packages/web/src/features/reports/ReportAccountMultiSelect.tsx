// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Shared multi-select account filter for reports (Expenses by Category,
// the account-detail reports, General Ledger). Empty selection = "all".
// The optional search box and type grouping are opt-in so the reports
// that predate them keep their exact look and behaviour.

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Account } from '@kis-books/shared';

export interface ReportAccountMultiSelectProps {
  accounts: Account[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Button label when nothing is selected, e.g. "All expense accounts". */
  allLabel: string;
  /** Shown in the panel when `accounts` is empty. */
  emptyLabel: string;
  /** Prefix each option with its account number (default true). */
  showNumbers?: boolean;
  /** Show a search box above the list (matches number or name). */
  searchable?: boolean;
  /**
   * Group options under account-type headings, in this map's key order
   * (type → heading). Each heading carries a select-all checkbox for the
   * visible accounts in that group. Omitted = flat list in given order.
   */
  groupLabels?: Record<string, string>;
}

const byNumberThenName = (a: Account, b: Account) => {
  const an = a.accountNumber ?? '';
  const bn = b.accountNumber ?? '';
  if (an && !bn) return -1;
  if (!an && bn) return 1;
  const c = an.localeCompare(bn, undefined, { numeric: true });
  return c !== 0 ? c : a.name.localeCompare(b.name);
};

export function ReportAccountMultiSelect({
  accounts,
  selected,
  onChange,
  allLabel,
  emptyLabel,
  showNumbers = true,
  searchable = false,
  groupLabels,
}: ReportAccountMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const optionLabel = (a: Account) =>
    showNumbers && a.accountNumber ? `${a.accountNumber} — ${a.name}` : a.name;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) =>
      a.name.toLowerCase().includes(q) || (a.accountNumber ?? '').toLowerCase().includes(q));
  }, [accounts, search]);

  // [heading | null, accounts][] — one ungrouped block when no groupLabels.
  const blocks = useMemo((): Array<[string | null, string, Account[]]> => {
    if (!groupLabels) return [[null, '', visible]];
    const out: Array<[string | null, string, Account[]]> = [];
    const known = Object.keys(groupLabels);
    for (const type of known) {
      const inGroup = visible.filter((a) => a.accountType === type).sort(byNumberThenName);
      if (inGroup.length > 0) out.push([groupLabels[type]!, type, inGroup]);
    }
    const other = visible.filter((a) => !known.includes(a.accountType)).sort(byNumberThenName);
    if (other.length > 0) out.push(['Other', 'other', other]);
    return out;
  }, [visible, groupLabels]);

  const setGroup = (ids: string[], on: boolean) => {
    if (on) onChange([...selected, ...ids.filter((id) => !selected.includes(id))]);
    else onChange(selected.filter((id) => !ids.includes(id)));
  };

  const label = selected.length === 0 ? allLabel : `${selected.length} selected`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
      >
        {label}
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>
      {open && (
        <div className={`absolute left-0 z-20 mt-1 overflow-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg ${searchable ? 'max-h-96 w-80' : 'max-h-72 w-72'}`}>
          {accounts.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-gray-500">{emptyLabel}</p>
          ) : (
            <>
              {searchable && (
                <input
                  type="search"
                  aria-label="Search accounts"
                  placeholder="Search accounts…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                  className="mb-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                />
              )}
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="mb-1 w-full rounded px-2 py-1 text-left text-xs font-medium text-blue-600 hover:bg-blue-50"
                >
                  Clear selection (show all)
                </button>
              )}
              {visible.length === 0 && (
                <p className="px-2 py-1.5 text-sm text-gray-500">No matching accounts</p>
              )}
              {blocks.map(([heading, key, list]) => {
                const ids = list.map((a) => a.id);
                const allOn = ids.every((id) => selected.includes(id));
                return (
                  <div key={key}>
                    {heading && (
                      <label className="mt-1 flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          aria-label={`Select all ${heading}`}
                          checked={allOn}
                          onChange={() => setGroup(ids, !allOn)}
                          className="rounded border-gray-300"
                        />
                        {heading}
                      </label>
                    )}
                    {list.map((a) => (
                      <label
                        key={a.id}
                        className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50 ${heading ? 'pl-5' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.includes(a.id)}
                          onChange={() => toggle(a.id)}
                          className="rounded border-gray-300"
                        />
                        <span className="truncate">{optionLabel(a)}</span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
