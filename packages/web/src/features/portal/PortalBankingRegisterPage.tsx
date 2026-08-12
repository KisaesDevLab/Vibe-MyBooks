// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePortal } from './PortalLayout';

// PORTAL_BANKING_V1 — sanitized mobile register for one account.
// Newest-first line cards with running balance; "Load more" appends
// the next page. No voids, memos, or reconciliation state (server
// strips them — this page just renders what it gets).

interface PortalRegisterLine {
  id: string;
  date: string;
  description: string | null;
  category: string | null;
  checkNumber: number | null;
  payment: number | null;
  deposit: number | null;
  runningBalance: number;
}

interface PortalRegisterData {
  account: { id: string; name: string; kind: 'bank' | 'card' };
  currentBalance: number;
  startDate: string;
  endDate: string;
  lines: PortalRegisterLine[];
  pagination: { page: number; perPage: number; totalRows: number; totalPages: number };
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

type RangeKey = '30d' | '90d' | 'ytd';

function rangeStart(range: RangeKey): string {
  if (range === 'ytd') return `${new Date().getFullYear()}-01-01`;
  const days = range === '30d' ? 30 : 90;
  return new Date(Date.now() - days * 86400000).toISOString().split('T')[0]!;
}

function formatDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function PortalBankingRegisterPage() {
  const { activeCompanyId } = usePortal();
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();

  const [range, setRange] = useState<RangeKey>('90d');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PortalRegisterData | null>(null);
  const [lines, setLines] = useState<PortalRegisterLine[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Company switch invalidates the account id — go back to the list.
  const [initialCompanyId] = useState(activeCompanyId);
  useEffect(() => {
    if (activeCompanyId && initialCompanyId && activeCompanyId !== initialCompanyId) {
      navigate('/portal/banking', { replace: true });
    }
  }, [activeCompanyId, initialCompanyId, navigate]);

  // New filters restart from page 1.
  useEffect(() => {
    setPage(1);
  }, [range, debouncedSearch]);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      companyId: activeCompanyId ?? '',
      startDate: rangeStart(range),
      page: String(page),
    });
    if (debouncedSearch.trim() !== '') params.set('search', debouncedSearch.trim());
    return params.toString();
  }, [activeCompanyId, range, debouncedSearch, page]);

  useEffect(() => {
    if (!activeCompanyId || !accountId) return;
    let cancelled = false;
    if (page === 1) {
      setData(null);
      setLines([]);
    } else {
      setLoadingMore(true);
    }
    setError(null);
    setRetryable(false);
    fetch(`${import.meta.env.BASE_URL}api/portal/banking/accounts/${accountId}/register?${query}`, {
      credentials: 'include',
    })
      .then((r) => {
        if (r.status === 403 || r.status === 404) {
          if (!cancelled) setError('This account is not available.');
          return null;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: PortalRegisterData | null) => {
        if (!d || cancelled) return;
        setData(d);
        setLines((prev) => (page === 1 ? d.lines : [...prev, ...d.lines]));
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load activity.');
          setRetryable(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMore(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeCompanyId, accountId, query, page, attempt]);

  const ranges: Array<{ key: RangeKey; label: string }> = [
    { key: '30d', label: 'Last 30 days' },
    { key: '90d', label: 'Last 90 days' },
    { key: 'ytd', label: 'This year' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="sticky top-0 -mx-4 px-4 py-3 bg-gray-50/95 backdrop-blur border-b border-gray-200 mb-4 z-10">
        <div className="flex items-center gap-3">
          <Link
            to="/portal/banking"
            className="shrink-0 p-1 -ml-1 rounded-md text-gray-500 hover:bg-gray-100"
            aria-label="Back to balances"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {data ? data.account.name : 'Activity'}
            </p>
            {data && (
              <p className="text-xs text-gray-500 tabular-nums">
                {data.account.kind === 'card' ? 'Balance owed ' : 'Balance '}
                {money.format(data.currentBalance)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {ranges.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              range === r.key
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search activity"
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
      </div>

      {error ? (
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-sm text-amber-800">
          <p>{error}</p>
          {retryable && (
            <button
              onClick={() => setAttempt((a) => a + 1)}
              className="mt-2 text-sm font-medium text-amber-900 underline hover:no-underline"
            >
              Retry
            </button>
          )}
        </div>
      ) : !data ? (
        <div className="py-10">
          <LoadingSpinner />
        </div>
      ) : lines.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
          <p className="text-sm text-gray-500">No activity in this period.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {lines.map((l) => (
              <div key={l.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs text-gray-500">{formatDay(l.date)}</p>
                  {l.payment != null ? (
                    <p className="text-sm font-semibold text-red-700 tabular-nums">
                      -{money.format(l.payment)}
                    </p>
                  ) : l.deposit != null ? (
                    <p className="text-sm font-semibold text-green-700 tabular-nums">
                      +{money.format(l.deposit)}
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-gray-500 tabular-nums">{money.format(0)}</p>
                  )}
                </div>
                <p className="text-sm text-gray-900 truncate">
                  {l.description ?? '—'}
                  {l.checkNumber != null && (
                    <span className="text-gray-500"> · Check #{l.checkNumber}</span>
                  )}
                </p>
                <div className="flex items-center justify-between gap-3 mt-0.5">
                  <p className="text-xs text-gray-500 truncate">{l.category ?? ''}</p>
                  <p className="text-xs text-gray-400 tabular-nums shrink-0">
                    Balance {money.format(l.runningBalance)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {data.pagination.page < data.pagination.totalPages && (
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={loadingMore}
              className="mt-4 w-full py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:border-gray-400 disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default PortalBankingRegisterPage;
