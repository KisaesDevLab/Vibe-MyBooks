// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import type { TxnType, TxnStatus } from '@kis-books/shared';
import { useTransactions } from '../../api/hooks/useTransactions';
import { useAccounts } from '../../api/hooks/useAccounts';
import { useContacts } from '../../api/hooks/useContacts';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { ArrowLeft, Plus, Search, X } from 'lucide-react';

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

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useMemo(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

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
  const startDate = searchParams.get('from') || '';
  const endDate = searchParams.get('to') || '';
  const urlSearch = searchParams.get('q') || '';

  // The search input is kept in local state for snappy typing; the debounced
  // value is what drives both the query and the URL update.
  const [search, setSearch] = useState(urlSearch);
  const [showNewMenu, setShowNewMenu] = useState(false);
  const debouncedSearch = useDebounce(search, 400);

  const updateParam = (key: string, value: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
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
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    search: debouncedSearch || undefined,
    limit: 50,
    offset: 0,
  });

  const { data: accountsData } = useAccounts({ limit: 500, isActive: true });
  const accountsList = accountsData?.data || [];
  // Contact list for the filter dropdown. Cheaply covers customers + vendors
  // in one fetch; the backend caps at 500 which is plenty for a solo /
  // small-firm workload.
  const { data: contactsData } = useContacts({ limit: 500, isActive: true });
  const contactsList = contactsData?.data || [];

  const firstLoad = isLoading && !data;

  if (firstLoad) return <LoadingSpinner className="py-12" />;
  if (isError && !data) return <ErrorMessage onRetry={() => refetch()} />;

  const txns = data?.data || [];

  const newTxnOptions = [
    { label: 'Journal Entry', path: '/transactions/new/journal-entry' },
    { label: 'Expense', path: '/transactions/new/expense' },
    { label: 'Transfer', path: '/transactions/new/transfer' },
    { label: 'Deposit', path: '/transactions/new/deposit' },
    { label: 'Cash Sale', path: '/transactions/new/cash-sale' },
  ];

  const hasFilters = typeFilter || statusFilter || accountFilter || contactFilter || startDate || endDate || search;

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
              {accountsList.map((a: any) => (
                <option key={a.id} value={a.id}>{a.accountNumber ? `${a.accountNumber} - ` : ''}{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Contact</label>
            <select value={contactFilter} onChange={(e) => setContactFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm max-w-[220px]">
              <option value="">All Contacts</option>
              {contactsList.map((c: any) => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
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

      {txns.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No transactions found.{hasFilters ? ' Try adjusting your filters.' : ' Create your first transaction.'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">No.</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payee / Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Memo</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {txns.map((txn) => (
                <tr key={txn.id} className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/transactions/${txn.id}`, { state: { returnTo } })}>
                  <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">{txn.txnDate}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {txnTypeLabels[txn.txnType] || txn.txnType}
                    {(txn as any).aiCategorized === 'ai' && (
                      <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium" title="Categorized by AI">AI</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{txn.txnNumber || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{(txn as any).contactName || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 truncate max-w-[200px]">{txn.memo || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono whitespace-nowrap">
                    {txn.total ? parseFloat(txn.total).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : '—'}
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
      )}
      <p className="text-sm text-gray-500 mt-2">{data?.total ?? 0} transactions</p>
    </div>
  );
}
