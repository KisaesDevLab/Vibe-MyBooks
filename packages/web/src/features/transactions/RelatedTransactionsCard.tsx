// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { Link, useLocation } from 'react-router-dom';
import { Paperclip } from 'lucide-react';
import { transactionTitle, type RelatedTransaction, type TransactionRelation } from '@kis-books/shared';
import { useRelatedTransactions } from '../../api/hooks/useTransactions';

const relationLabels: Record<TransactionRelation, string> = {
  payment: 'Payment applied',
  paid_bill: 'Bill paid',
  paid_invoice: 'Applied to invoice',
  credit: 'Credit applied',
  credited_bill: 'Applied to bill',
};

function detailPath(r: RelatedTransaction): string {
  if (r.txnType === 'bill') return `/bills/${r.id}`;
  if (r.txnType === 'invoice') return `/invoices/${r.id}`;
  return `/transactions/${r.id}`;
}

function money(value: string | null): string {
  return value ? `$${parseFloat(value).toFixed(2)}` : '';
}

// What this transaction is tied to — the payments applied to a bill, the
// bills a payment paid, and the invoice-side equivalents. Renders nothing
// when there is nothing linked (most transaction types).
export function RelatedTransactionsCard({ transactionId }: { transactionId: string }) {
  const location = useLocation();
  const { data, isLoading, isError, refetch } = useRelatedTransactions(transactionId);

  if (isLoading) return null;
  if (isError) {
    return (
      <div className="mt-6 bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-sm text-gray-600">
        Couldn&apos;t load related transactions.{' '}
        <button onClick={() => refetch()} className="underline text-gray-900">Retry</button>
      </div>
    );
  }
  if (!data || data.related.length === 0) return null;

  return (
    <div className="mt-6 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Related Transactions</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 text-gray-500">Relationship</th>
              <th className="text-left py-2 text-gray-500">Transaction</th>
              <th className="text-left py-2 text-gray-500">Date</th>
              <th className="text-left py-2 text-gray-500">Name</th>
              <th className="text-right py-2 text-gray-500">Applied</th>
              <th className="text-right py-2 text-gray-500">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.related.map((r) => (
              <tr key={r.id} className="border-b border-gray-100">
                <td className="py-2 text-gray-600">{relationLabels[r.relation] ?? r.relation}</td>
                <td className="py-2">
                  <Link
                    to={detailPath(r)}
                    state={{ returnTo: `${location.pathname}${location.search}`, returnLabel: 'previous transaction' }}
                    className="text-gray-900 underline hover:text-gray-600"
                  >
                    {transactionTitle(r)}
                  </Link>
                  {r.vendorInvoiceNumber && <span className="text-xs text-gray-400 ml-2">Inv {r.vendorInvoiceNumber}</span>}
                  {r.status === 'void' && (
                    <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">void</span>
                  )}
                  {r.attachmentCount > 0 && (
                    <span className="ml-2 inline-flex items-center text-xs text-gray-400" title={`${r.attachmentCount} attachment${r.attachmentCount === 1 ? '' : 's'}`}>
                      <Paperclip className="h-3 w-3 mr-0.5" />{r.attachmentCount}
                    </span>
                  )}
                </td>
                <td className="py-2 text-gray-600">{r.txnDate}</td>
                <td className="py-2 text-gray-600">{r.contactName || '—'}</td>
                <td className="py-2 text-right font-mono">{money(r.appliedAmount)}</td>
                <td className="py-2 text-right font-mono">{money(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.truncated && (
        <p className="mt-3 text-xs text-gray-500">Only the first {data.related.length} are shown.</p>
      )}
    </div>
  );
}
