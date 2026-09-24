// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVendorCredits, type VendorCreditSortKey } from '../../api/hooks/useAp';
import { SortableTh } from '../../components/ui/SortableTh';
import { useColumnView } from '../../hooks/useColumnView';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Pagination } from '../../components/ui/Pagination';

// Rows-per-page choices — server caps at 500 elsewhere in AP; keep parity.
const PAGE_SIZE_OPTIONS = ['25', '50', '100', '250', '500'];
const DEFAULT_PAGE_SIZE = '50';
const SORT_KEYS: readonly VendorCreditSortKey[] = ['txnNumber', 'contactName', 'txnDate', 'total', 'balanceDue', 'memo'];
const TH = 'text-xs font-medium text-gray-500';

export function VendorCreditListPage() {
  const navigate = useNavigate();
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [offset, setOffset] = useState(0);
  const limit = parseInt(pageSize, 10);
  // Sort is server-side (the list paginates).
  const view = useColumnView<VendorCreditSortKey>('vibe:vendor-credits:view', {
    sortKeys: SORT_KEYS, defaultSort: { col: 'txnDate', dir: 'desc' },
    defaultDir: (col) => (col === 'txnDate' || col === 'total' || col === 'balanceDue' ? 'desc' : 'asc'),
  });
  useEffect(() => setOffset(0), [view.signature]);
  const { data, isLoading } = useVendorCredits({
    limit, offset,
    ...(view.sortCol ? { sortBy: view.sortCol, sortDir: view.sortDir } : {}),
  });
  const credits = data?.data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vendor Credits</h1>
        <Button onClick={() => navigate('/vendor-credits/new')}>Enter Vendor Credit</Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        {isLoading ? (
          <LoadingSpinner className="py-12" />
        ) : credits.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-12">No vendor credits yet.</p>
        ) : (
          <table className="min-w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <SortableTh padding="py-2 px-3" className={TH} label="Credit #" {...view.thProps('txnNumber')} />
                <SortableTh padding="py-2 px-3" className={TH} label="Vendor" {...view.thProps('contactName')} />
                <SortableTh padding="py-2 px-3" className={TH} label="Date" {...view.thProps('txnDate')} />
                <SortableTh padding="py-2 px-3" className={TH} align="right" label="Total" {...view.thProps('total')} />
                <SortableTh padding="py-2 px-3" className={TH} align="right" label="Available" {...view.thProps('balanceDue')} />
                <SortableTh padding="py-2 px-3" className={TH} label="Memo" {...view.thProps('memo')} />
              </tr>
            </thead>
            <tbody>
              {credits.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 px-3 text-sm font-mono">{c.txnNumber}</td>
                  <td className="py-2 px-3 text-sm">{c.contactName}</td>
                  <td className="py-2 px-3 text-sm">{c.txnDate}</td>
                  <td className="py-2 px-3 text-sm text-right font-mono">
                    ${parseFloat(c.total || '0').toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-sm text-right font-mono">
                    ${parseFloat(c.balanceDue || '0').toFixed(2)}
                  </td>
                  <td className="py-2 px-3 text-sm">{c.memo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {data && (
        <Pagination
          total={data.total}
          limit={limit}
          offset={offset}
          onChange={setOffset}
          unit="credits"
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={(size) => { setPageSize(size); setOffset(0); }}
        />
      )}
    </div>
  );
}
