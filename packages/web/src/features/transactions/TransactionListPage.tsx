// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import type { TxnType, TxnStatus, BulkUpdateTransactionsInput } from '@kis-books/shared';
import { useTransactions, useBulkUpdateTransactions } from '../../api/hooks/useTransactions';
import { useAccounts } from '../../api/hooks/useAccounts';
import { useContacts } from '../../api/hooks/useContacts';
import { useTags } from '../../api/hooks/useTags';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Pagination } from '../../components/ui/Pagination';
import { ArrowLeft, Plus, Search, X } from 'lucide-react';
import { useDebouncedValue, useDebouncedDate } from '../../hooks/useDebouncedValue';

const PAGE_SIZE = 50;

type TxnSortKey = 'date' | 'type' | 'number' | 'payee' | 'memo' | 'category' | 'amount' | 'status';

function SortableTh({ sortKey, label, align, sortBy, sortDir, onSort }: {
  sortKey: TxnSortKey;
  label: string;
  align?: 'left' | 'right' | 'center';
  sortBy: '' | TxnSortKey;
  sortDir: 'asc' | 'desc';
  onSort: (k: TxnSortKey) => void;
}) {
  const active = sortBy === sortKey;
  const justify = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  return (
    <th className={`px-4 py-3 text-${align || 'left'} text-xs font-medium text-gray-500 uppercase`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 uppercase hover:text-gray-700 ${justify} ${active ? 'text-gray-800' : ''}`}
      >
        {label}
        <span className="text-[10px] leading-none">{active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

const txnTypeLabels: Record<string, string> = {
  invoice: 'Invoice',
  customer_payment: 'Payment',
  cash_sale: 'Cash Sale',
  expense: 'Expense',
  deposit: 'Deposit',
  transfer: 'Transfer',
  journal_entry: 'Journal Entry',
  credit_memo: 'Credit Memo',
  customer_refund: 'Refund',
};

const statusColors: Record<string, string> = {
  posted: 'bg-green-100 text-green-700',
  draft: 'bg-yellow-100 text-yellow-700',
  void: 'bg-red-100 text-red-700',
};

export function TransactionListPage() {
  const navigate = useNavigate();
  const location = useLocation();
  // Filters are URL-synced so (a) they survive refresh, (b) the URL is
  // shareable, and (c) navigating back from TransactionDetail restores the
  // exact filtered view the operator was looking at.
  const [searchParams, setSearchParams] = useSearchParams();
  const typeFilter = (searchParams.get('type') || '') as TxnType | '';
  const statusFilter = (searchParams.get('status') || '') as TxnStatus | '';
  const accountFilter = searchParams.get('account') || '';
  const contactFilter = searchParams.get('contact') || '';
  // Bulk-import success links pass `?source=accounting_power_import`
  // (or qbo / trial_balance) so the operator lands on the rows just
  // posted instead of the unfiltered list. Threaded straight through
  // to useTransactions, which forwards to /transactions?source=... —
  // ledger.listTransactions filters on transactions.source, indexed.
  const sourceFilter = searchParams.get('source') || '';
  const startDate = searchParams.get('from') || '';
  const endDate = searchParams.get('to') || '';
  // ADR 0XX §5.2 — list filter is header-level: "show transactions
  // where any line carries this tag." Backend implements this via an
  // EXISTS subquery on journal_lines.
  const tagFilter = searchParams.get('tagId') || '';
  const urlSearch = searchParams.get('q') || '';
  // Column sort — URL-synced so it survives navigation/refresh. Server-side
  // (sorts the full filtered set, not just the visible page).
  const sortBy = (searchParams.get('sortBy') || '') as '' | TxnSortKey;
  const sortDir = searchParams.get('sortDir') === 'asc' ? 'asc' : 'desc';
  // Pagination is URL-synced so the Back button from a detail page drops
  // the operator back on the exact page + filter combo. offset clamped to
  // a non-negative multiple of PAGE_SIZE.
  const parsedOffset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);
  const offset = Math.floor(parsedOffset / PAGE_SIZE) * PAGE_SIZE;

  // The search input is kept in local state for snappy typing; the debounced
  // value is what drives both the query and the URL update.
  const [search, setSearch] = useState(urlSearch);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const debouncedSearch = useDebouncedValue(search);

  // Multi-select + bulk-edit state. Selection is a Set of txn ids; the bulk
  // toolbar appears whenever at least one row is selected.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [bulkContactId, setBulkContactId] = useState('');
  const [bulkTagId, setBulkTagId] = useState('');
  const bulkUpdate = useBulkUpdateTransactions();

  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkCategoryId('');
    setBulkContactId('');
    setBulkTagId('');
    bulkUpdate.reset();
  };
  const applyBulk = () => {
    const input: BulkUpdateTransactionsInput = { txnIds: Array.from(selectedIds) };
    if (bulkCategoryId) input.setCategoryAccountId = bulkCategoryId;
    if (bulkContactId) input.setPayeeContactId = bulkContactId;
    if (bulkTagId) input.setTagId = bulkTagId;
    if (
      input.setCategoryAccountId === undefined &&
      input.setPayeeContactId === undefined &&
      input.setTagId === undefined
    ) {
      return;
    }
    bulkUpdate.mutate(input, {
      onSuccess: () => {
        setSelectedIds(new Set());
        setBulkCategoryId('');
        setBulkContactId('');
        setBulkTagId('');
      },
    });
  };

  const updateParam = (key: string, value: string, opts: { resetOffset?: boolean } = {}) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        // Any filter change invalidates the current offset — otherwise the
        // user is on "page 3" of a much smaller filtered set and sees no
        // results. Explicit resetOffset=false lets the pagination control
        // itself change offset without clobbering.
        if (opts.resetOffset !== false && key !== 'offset') next.delete('offset');
        return next;
      },
      { replace: true },
    );
  };

  const setTypeFilter = (v: TxnType | '') => updateParam('type', v);
  const setStatusFilter = (v: TxnStatus | '') => updateParam('status', v);
  const setAccountFilter = (v: string) => updateParam('account', v);
  const setContactFilter = (v: string) => updateParam('contact', v);
  const setStartDate = (v: string) => updateParam('from', v);
  const setEndDate = (v: string) => updateParam('to', v);

  // Date inputs are controlled by raw local state so typing stays
  // responsive; the URL param (and therefore the query) only updates
  // once the value is a complete date and stable — native date inputs
  // fire a change event per segment while the user is still typing.
  const [fromInput, setFromInput] = useState(startDate);
  const [toInput, setToInput] = useState(endDate);
  const debFrom = useDebouncedDate(fromInput);
  const debTo = useDebouncedDate(toInput);
  useEffect(() => {
    if (debFrom !== startDate) setStartDate(debFrom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debFrom]);
  useEffect(() => {
    if (debTo !== endDate) setEndDate(debTo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debTo]);
  // External URL changes (back button, drill-down links) re-sync the inputs.
  useEffect(() => { setFromInput(startDate); }, [startDate]);
  useEffect(() => { setToInput(endDate); }, [endDate]);
  const setTagFilter = (v: string) => updateParam('tagId', v);
  const setOffset = (v: number) => updateParam('offset', v > 0 ? String(v) : '', { resetOffset: false });

  // Push the debounced search text into the URL.
  useEffect(() => {
    if (debouncedSearch !== urlSearch) updateParam('q', debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const { data, isLoading, isFetching, isError, refetch } = useTransactions({
    txnType: typeFilter || undefined,
    status: statusFilter || undefined,
    accountId: accountFilter || undefined,
    contactId: contactFilter || undefined,
    source: sourceFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    tagId: tagFilter || undefined,
    search: debouncedSearch || undefined,
    sortBy: sortBy || undefined,
    sortDir: sortBy ? sortDir : undefined,
    limit: PAGE_SIZE,
    offset,
  });

  // Click a column header to sort by it; click again to flip direction.
  const toggleSort = (key: TxnSortKey) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const nextDir = sortBy === key && sortDir === 'asc' ? 'desc' : 'asc';
      next.set('sortBy', key);
      next.set('sortDir', nextDir);
      next.set('offset', '0');
      return next;
    });
  };

  const { data: tagsData } = useTags({ isActive: true });
  const tagsList = tagsData?.tags || [];

  const { data: accountsData } = useAccounts({ limit: 500, isActive: true });
  const accountsList = accountsData?.data || [];
  // Contact list for the filter dropdown. Cheaply covers customers + vendors
  // in one fetch; the backend caps at 500 which is plenty for a solo /
  // small-firm workload.
  const { data: contactsData } = useContacts({ limit: 500, isActive: true });
  const contactsList = contactsData?.data || [];

  // Show the split-level tag-filter banner once per session when the
  // user first applies a tag filter, explaining that the scope is
  // "any line carries this tag" per ADR 0XX §5.2.
  const [showTagBanner, setShowTagBanner] = useState(() => {
    if (typeof window === 'undefined') return false;
    return !window.localStorage.getItem('vb_tagFilterBannerDismissed');
  });
  useEffect(() => {
    if (!tagFilter) setShowTagBanner(false);
  }, [tagFilter]);
  const dismissTagBanner = () => {
    try { window.localStorage.setItem('vb_tagFilterBannerDismissed', '1'); } catch { /* ignore */ }
    setShowTagBanner(false);
  };

  const firstLoad = isLoading && !data;

  if (firstLoad) return <LoadingSpinner className="py-12" />;
  if (isError && !data) return <ErrorMessage onRetry={() => refetch()} />;

  const txns = data?.data || [];

  // Select-all toggles only the rows on the current page.
  const allOnPageSelected = txns.length > 0 && txns.every((t) => selectedIds.has(t.id));
  const toggleAllOnPage = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) txns.forEach((t) => next.delete(t.id));
      else txns.forEach((t) => next.add(t.id));
      return next;
    });
  // Category accounts (P&L) for the bulk "Set Category" dropdown — the same
  // income/expense set the backend treats as a transaction's category.
  const categoryAccounts = accountsList.filter((a) =>
    ['revenue', 'other_revenue', 'cogs', 'expense', 'other_expense'].includes(a.accountType),
  );

  const newTxnOptions = [
    { label: 'Journal Entry', path: '/transactions/new/journal-entry' },
    { label: 'Expense', path: '/transactions/new/expense' },
    { label: 'Transfer', path: '/transactions/new/transfer' },
    { label: 'Deposit', path: '/transactions/new/deposit' },
    { label: 'Cash Sale', path: '/transactions/new/cash-sale' },
  ];

  const hasFilters = typeFilter || statusFilter || accountFilter || contactFilter || startDate || endDate || tagFilter || search;

  const clearFilters = () => {
    setSearch('');
    setSearchParams(new URLSearchParams(), { replace: true });
  };

  // The full current URL (path + query) so TransactionDetail can offer a
  // Back button that returns to the exact filtered view.
  const returnTo = `${location.pathname}${location.search}`;

  // When the operator arrived here via a QuickZoom drill-down from a
  // report, location.state carries the report URL + a human label so we
  // can render a "← Back to <report>" link above the filter bar.
  const backToReport = location.state as { returnTo?: string; returnLabel?: string } | null;

  return (
    <div>
      {backToReport?.returnTo && (
        <button
          onClick={() => navigate(backToReport.returnTo!)}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Back to {backToReport.returnLabel || 'Report'}
        </button>
      )}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
        <div className="relative">
          <Button size="sm" onClick={() => setShowNewMenu(!showNewMenu)}>
            <Plus className="h-4 w-4 mr-1" /> New Transaction
          </Button>
          {showNewMenu && (
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg border border-gray-200 shadow-lg z-10 py-1">
              {newTxnOptions.map((opt) => (
                <button
                  key={opt.path}
                  onClick={() => { navigate(opt.path); setShowNewMenu(false); }}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-4 space-y-3">
        <div className="flex gap-3 flex-wrap items-end">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <Search className="absolute left-3 bottom-2.5 h-4 w-4 text-gray-400" />
            <input placeholder="Memo, number, contact..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TxnType | '')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">All Types</option>
              {Object.entries(txnTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TxnStatus | '')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">All</option>
              <option value="posted">Posted</option>
              <option value="draft">Draft</option>
              <option value="void">Void</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Account</label>
            <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm max-w-[200px]">
              <option value="">All Accounts</option>
              {accountsList.map((a) => (
                <option key={a.id} value={a.id}>{a.accountNumber ? `${a.accountNumber} - ` : ''}{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Contact</label>
            <select value={contactFilter} onChange={(e) => setContactFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm max-w-[220px]">
              <option value="">All Contacts</option>
              {contactsList.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tag</label>
            <select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm max-w-[200px]">
              <option value="">All Tags</option>
              {tagsList.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={fromInput} onChange={(e) => setFromInput(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={toInput} onChange={(e) => setToInput(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 pb-2">
              <X className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
          {isFetching && <span className="text-xs text-gray-400 pb-2.5">Loading...</span>}
        </div>
      </div>

      {showTagBanner && tagFilter && (
        <div className="mb-4 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-900 flex items-start justify-between">
          <div>
            <p className="font-medium mb-0.5">Tag filter is line-level</p>
            <p className="text-primary-800">
              A transaction appears in the results when <span className="font-semibold">any</span> of its lines carries the selected tag.
              Totals remain the full transaction totals; drill into a transaction to see which lines matched.
            </p>
          </div>
          <button onClick={dismissTagBanner} className="text-primary-600 hover:text-primary-900 ml-3">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {/* Bulk-edit toolbar — visible while rows are selected. */}
      {selectedIds.size > 0 && (
        <div className="mb-4 rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 flex flex-wrap items-end gap-3">
          <span className="text-sm font-medium text-primary-900 pb-2">{selectedIds.size} selected</span>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Set Category</label>
            <select value={bulkCategoryId} onChange={(e) => setBulkCategoryId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm max-w-[200px]">
              <option value="">— No change —</option>
              {categoryAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.accountNumber ? `${a.accountNumber} - ` : ''}{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Set Payee</label>
            <select value={bulkContactId} onChange={(e) => setBulkContactId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm max-w-[200px]">
              <option value="">— No change —</option>
              {contactsList.map((c) => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Set Tag</label>
            <select value={bulkTagId} onChange={(e) => setBulkTagId(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm max-w-[200px]">
              <option value="">— No change —</option>
              {tagsList.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <Button size="sm" onClick={applyBulk} loading={bulkUpdate.isPending}
            disabled={!bulkCategoryId && !bulkContactId && !bulkTagId}>Apply</Button>
          <button onClick={clearSelection} className="text-sm text-gray-500 hover:text-gray-700 pb-2">Clear</button>
          {bulkUpdate.error && <span className="text-sm text-red-600 pb-2">{bulkUpdate.error.message}</span>}
        </div>
      )}
      {bulkUpdate.isSuccess && bulkUpdate.data && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800 flex items-center justify-between">
          <span>
            Updated {bulkUpdate.data.updated} transaction{bulkUpdate.data.updated === 1 ? '' : 's'}.
            {bulkUpdate.data.skipped.length > 0
              ? ` ${bulkUpdate.data.skipped.length} skipped (splits, void, locked, or reconciled).`
              : ''}
          </span>
          <button onClick={() => bulkUpdate.reset()} className="text-green-600 hover:text-green-900">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {txns.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No transactions found.{hasFilters ? ' Try adjusting your filters.' : ' Create your first transaction.'}
        </div>
      ) : (
        <>
        {/* Desktop: full table (horizontal-scrolls on medium+ if narrow). */}
        <div className="hidden md:block bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleAllOnPage}
                    aria-label="Select all on page" className="rounded border-gray-300" />
                </th>
                <SortableTh sortKey="date" label="Date" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh sortKey="type" label="Type" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh sortKey="number" label="No." sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh sortKey="payee" label="Payee / Customer" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh sortKey="memo" label="Memo" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh sortKey="category" label="Category" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tag</th>
                <SortableTh sortKey="amount" label="Amount" align="right" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh sortKey="status" label="Status" align="center" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {txns.map((txn) => (
                <tr key={txn.id} className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/transactions/${txn.id}`, { state: { returnTo } })}>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(txn.id)} onChange={() => toggleSelected(txn.id)}
                      aria-label="Select transaction" className="rounded border-gray-300" />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{txn.txnDate}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {txnTypeLabels[txn.txnType] || txn.txnType}
                    {txn.aiCategorized === 'ai' && (
                      <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium" title="Categorized by AI">AI</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{txn.txnNumber || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{txn.contactName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[200px]">{txn.memo || '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    {(() => {
                      // The transaction's category = its P&L account(s). One →
                      // show it; multiple → "— Split —"; none → "—".
                      const cats = (txn as { lineCategories?: string[] | null }).lineCategories ?? null;
                      if (!cats || cats.length === 0) return <span className="text-gray-300">—</span>;
                      if (cats.length === 1) return <span className="text-gray-900">{cats[0]}</span>;
                      return <span title={cats.join(', ')} className="text-gray-500 cursor-help">— Split —</span>;
                    })()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {(() => {
                      // ADR 0XX §4.1 rendering: single pill when uniform,
                      // "Mixed" when lines differ, "—" when all untagged.
                      const tags = (txn as { lineTags?: string[] | null }).lineTags ?? null;
                      if (!tags || tags.length === 0) return <span className="text-gray-300">—</span>;
                      if (tags.length === 1) {
                        return (
                          <span className="inline-flex items-center rounded-full bg-primary-50 text-primary-700 px-2 py-0.5 text-xs font-medium">
                            {tags[0]}
                          </span>
                        );
                      }
                      return (
                        <span
                          title={tags.join(', ')}
                          className="inline-flex items-center rounded-full bg-amber-50 text-amber-800 px-2 py-0.5 text-xs font-medium cursor-help"
                        >
                          Mixed ({tags.length})
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono whitespace-nowrap">
                    {(() => {
                      // displayTotal = total with a server-side fallback to the
                      // journal-line magnitude (JEs/transfers/imports have no
                      // document total and used to render as an em dash).
                      const amount = txn.displayTotal ?? txn.total;
                      return amount ? parseFloat(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '—';
                    })()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[txn.status] || ''}`}>
                      {txn.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Mobile: compact card list — readable without horizontal scroll. */}
        <div className="md:hidden space-y-2">
          {txns.map((txn) => {
            const cats = (txn as { lineCategories?: string[] | null }).lineCategories ?? null;
            const categoryLabel = !cats || cats.length === 0 ? null : cats.length === 1 ? cats[0] : '— Split —';
            const amount = txn.displayTotal ?? txn.total;
            const amountLabel = amount ? parseFloat(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '—';
            return (
              <button
                key={txn.id}
                onClick={() => navigate(`/transactions/${txn.id}`, { state: { returnTo } })}
                className="w-full text-left bg-white rounded-lg border border-gray-200 shadow-sm p-3 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500 whitespace-nowrap">{txn.txnDate}</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[txn.status] || ''}`}>
                    {txn.status}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {txn.contactName || txnTypeLabels[txn.txnType] || txn.txnType}
                    </div>
                    {txn.memo && <div className="text-xs text-gray-500 truncate">{txn.memo}</div>}
                    {categoryLabel && <div className="text-xs text-gray-400 truncate">{categoryLabel}</div>}
                  </div>
                  <div className="text-sm text-gray-900 text-right font-mono whitespace-nowrap">{amountLabel}</div>
                </div>
              </button>
            );
          })}
        </div>
        </>
      )}
      <Pagination
        total={data?.total ?? 0}
        limit={PAGE_SIZE}
        offset={offset}
        onChange={setOffset}
        unit="transactions"
      />
    </div>
  );
}
