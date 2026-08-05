// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useVendorCredits } from '../../api/hooks/useAp';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Pagination } from '../../components/ui/Pagination';

// Rows-per-page choices — server caps at 500 elsewhere in AP; keep parity.
const PAGE_SIZE_OPTIONS = ['25', '50', '100', '250', '500'];
const DEFAULT_PAGE_SIZE = '50';

export function VendorCreditListPage() {
  const navigate = useNavigate();
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [offset, setOffset] = useState(0);
  const limit = parseInt(pageSize, 10);
  const { data, isLoading } = useVendorCredits({ limit, offset });
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
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2 px-3">Credit #</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2 px-3">Vendor</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2 px-3">Date</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase py-2 px-3">Total</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase py-2 px-3">Available</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2 px-3">Memo</th>
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
