// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tab 2 — amounts already on the ledger, sitting in the suspense account.
// Clearing one moves EVERY suspense line on that transaction to the account
// you pick. A transaction whose suspense amount needs splitting across
// several categories has to go through the transaction editor instead, which
// is what the split badge and the row link are for.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Scissors } from 'lucide-react';
import { formatMoney } from '../../../utils/money';
import { TableScroll } from '../../../components/ui/TableScroll';
import { Pagination } from '../../../components/ui/Pagination';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toaster';
import { AccountSelector } from '../../../components/forms/AccountSelector';
import { SelectionActionBar } from './SelectionActionBar';
import { useInSuspense, useClearSuspense } from '../../../api/hooks/useUncategorized';

const PAGE_SIZE = 50;

export function InSuspenseTab() {
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categoryId, setCategoryId] = useState('');

  const toast = useToast();
  const query = useInSuspense({ limit: PAGE_SIZE, offset, search });
  const clear = useClearSuspense();

  const rows = query.data?.rows ?? [];
  const total = query.data?.total ?? 0;
  const pageIds = rows.map((r) => r.transactionId);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const changePage = (next: number) => { setOffset(next); setSelected(new Set()); };

  const applyCategory = () => {
    if (!categoryId || selected.size === 0) return;
    clear.mutate(
      { transactionIds: [...selected], accountId: categoryId },
      {
        onSuccess: (res) => {
          const parts = [`Moved ${res.updated} transaction(s) out of suspense.`];
          if (res.skipped.length > 0) {
            // Locked periods, voids and adjusting entries are skipped by the
            // ledger, never forced. Say which so the reason is actionable.
            const reasons = [...new Set(res.skipped.map((s) => s.reason))].join(', ');
            parts.push(`${res.skipped.length} skipped (${reasons}).`);
          }
          toast.success(parts.join(' '));
          setSelected(new Set());
          setCategoryId('');
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not clear suspense.'),
      },
    );
  };

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOffset(0); setSelected(new Set()); }}
        placeholder="Search memo or payee"
        className="w-full sm:w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />

      <SelectionActionBar
        selectedCount={selected.size}
        totalCount={rows.length}
        allSelected={allSelected}
        disabled={clear.isPending}
        onToggleAll={() => setSelected(allSelected ? new Set() : new Set(pageIds))}
        onClearSelection={() => setSelected(new Set())}
      >
        <div className="w-56">
          <AccountSelector value={categoryId} onChange={setCategoryId} compact />
        </div>
        <Button onClick={applyCategory} disabled={clear.isPending || !categoryId || selected.size === 0}>
          {clear.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          Set category
        </Button>
      </SelectionActionBar>

      <TableScroll>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="w-10 px-3 py-2" />
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Payee</th>
              <th className="px-3 py-2">Memo</th>
              <th className="px-3 py-2 text-right">In suspense</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {query.isLoading && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">Loading…</td></tr>
            )}
            {query.isError && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-red-600">
                Could not load suspense. <button className="underline" onClick={() => query.refetch()}>Retry</button>
              </td></tr>
            )}
            {!query.isLoading && !query.isError && rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                Suspense is empty. Nothing on the ledger is unclassified.
              </td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.transactionId} className={selected.has(r.transactionId) ? 'bg-indigo-50' : undefined}>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.has(r.transactionId)}
                    onChange={() => toggle(r.transactionId)}
                    aria-label={`Select ${r.memo ?? 'transaction'}`}
                  />
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-gray-600">{r.txnDate}</td>
                <td className="px-3 py-2 text-gray-900">{r.contactName ?? '—'}</td>
                <td className="px-3 py-2 text-gray-700">
                  {r.memo ?? '—'}
                  {r.isSplit && (
                    <span
                      className="ml-2 inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800"
                      title="This entry is split. Setting a category here sends every suspense line on it to the same account."
                    >
                      <Scissors className="h-3 w-3" />
                      Split
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.amount)}</td>
                <td className="px-3 py-2 text-right">
                  <Link
                    to={`/transactions/${r.transactionId}`}
                    className="text-xs text-primary-700 underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>

      <Pagination total={total} limit={PAGE_SIZE} offset={offset} onChange={changePage} unit="transactions" />
    </div>
  );
}
