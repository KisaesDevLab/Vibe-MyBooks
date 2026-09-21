// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useTransaction, useVoidTransaction, useDuplicateTransaction } from '../../api/hooks/useTransactions';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { ArrowLeft, Copy, Ban, Download, Pencil, Repeat } from 'lucide-react';
import { buildTransactionHeaderFields, contactRoleLabel, transactionTitle, txnTypeLabel, type TransactionHeaderField } from '@kis-books/shared';
import { AttachmentPanel } from '../attachments/AttachmentPanel';
import { AskClientAboutTransactionButton } from './AskClientAboutTransactionButton';
import { RecurringScheduleModal } from './RecurringScheduleModal';
import { RelatedTransactionsCard } from './RelatedTransactionsCard';
import { TransactionReportButton } from './TransactionReportButton';

const billStatusColors: Record<string, string> = {
  unpaid: 'bg-yellow-100 text-yellow-700',
  partial: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
};

function fieldValue(f: TransactionHeaderField) {
  switch (f.kind) {
    case 'money':
      return <span className="font-mono">${parseFloat(f.value).toFixed(2)}</span>;
    case 'datetime':
      return new Date(f.value).toLocaleString();
    case 'multiline':
      return <span className="whitespace-pre-line">{f.value}</span>;
    default:
      return f.value;
  }
}

export function TransactionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // TransactionListPage stashes the filtered URL (path + query) in
  // location.state.returnTo when you click a row. ReportTable does the
  // same when drilling from a record-list report (Invoice List, Journal
  // Entries, etc.) with the report's title as returnLabel. Deep links /
  // refreshes lose state, so we fall back to the bare list.
  const navState = location.state as { returnTo?: string; returnLabel?: string } | null;
  const returnTo = navState?.returnTo || '/transactions';
  const returnLabel = navState?.returnLabel || 'Transactions';
  const { data, isLoading, isError, refetch } = useTransaction(id!);
  const voidTxn = useVoidTransaction();
  const duplicateTxn = useDuplicateTransaction();
  const [showVoidDialog, setShowVoidDialog] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [showRecurring, setShowRecurring] = useState(false);

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError || !data) return <ErrorMessage onRetry={() => refetch()} />;

  const txn = data.transaction;
  const lines = txn.lines || [];
  // Which header facts matter depends on the type — a bill names its vendor
  // and the vendor's invoice number, a check its payee and check number. The
  // Transaction Report prints the same list.
  // The contact sits beside the title, so it is left out of the card.
  const headerFields = buildTransactionHeaderFields(txn).filter((f) => f.key !== 'contact');
  const showLineName = lines.some((l) => l.contactName);
  const showLineTag = lines.some((l) => l.tagName);

  const handleVoid = () => {
    if (!voidReason.trim()) return;
    voidTxn.mutate({ id: txn.id, reason: voidReason }, {
      onSuccess: () => { setShowVoidDialog(false); refetch(); },
    });
  };

  const handleDuplicate = () => {
    duplicateTxn.mutate(txn.id, { onSuccess: () => navigate('/transactions') });
  };

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    setPdfError('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`${import.meta.env.BASE_URL}api/v1/transactions/${txn.id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `receipt-${txn.txnNumber || txn.id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'PDF download failed');
    }
    setPdfLoading(false);
  };

  const hasPdf = txn.txnType === 'cash_sale' || txn.txnType === 'invoice';

  const editRoutes: Record<string, string> = {
    invoice: `/invoices/${txn.id}/edit`,
    expense: `/transactions/${txn.id}/edit/expense`,
    deposit: `/transactions/${txn.id}/edit/deposit`,
    transfer: `/transactions/${txn.id}/edit/transfer`,
    journal_entry: `/transactions/${txn.id}/edit/journal-entry`,
    cash_sale: `/transactions/${txn.id}/edit/cash-sale`,
  };
  const canEdit = txn.status !== 'void';

  return (
    <div>
      <button
        onClick={() => navigate(returnTo)}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-3"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {returnLabel}
      </button>
      {pdfError && (
        <div role="alert" className="mb-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{pdfError}</span>
          <button onClick={() => setPdfError('')} className="text-xs underline text-red-600 hover:text-red-800">Dismiss</button>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {transactionTitle(txn)}
          </h1>
          {txn.contactName && (
            <p className="text-sm text-gray-700 mt-0.5">
              <span className="text-gray-500">{contactRoleLabel(txn.txnType)}:</span> {txn.contactName}
            </p>
          )}
          <div className="flex gap-2 mt-1">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
              txn.status === 'posted' ? 'bg-green-100 text-green-700' :
              txn.status === 'void' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
            }`}>{txn.status}</span>
            {txn.invoiceStatus && (
              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                {txn.invoiceStatus}
              </span>
            )}
            {txn.billStatus && (
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${billStatusColors[txn.billStatus] || 'bg-gray-100 text-gray-700'}`}>
                {txn.billStatus}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && editRoutes[txn.txnType] && (
            <Button variant="secondary" size="sm" onClick={() => navigate(editRoutes[txn.txnType]!)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
          {hasPdf && (
            <Button variant="secondary" size="sm" onClick={handleDownloadPdf} loading={pdfLoading}>
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
          )}
          <TransactionReportButton transactionId={txn.id} />
          <Button variant="secondary" size="sm" onClick={handleDuplicate} loading={duplicateTxn.isPending}>
            <Copy className="h-4 w-4 mr-1" /> Duplicate
          </Button>
          {txn.status === 'posted' && (
            <Button variant="secondary" size="sm" onClick={() => setShowRecurring(true)}>
              <Repeat className="h-4 w-4 mr-1" /> Make recurring
            </Button>
          )}
          {txn.status !== 'void' && (
            <AskClientAboutTransactionButton
              transactionId={txn.id}
              contextSummary={
                [
                  txnTypeLabel(txn),
                  txn.txnNumber,
                  txn.contactName,
                  txn.total ? `$${txn.total}` : null,
                  txn.txnDate,
                ]
                  .filter(Boolean)
                  .join(' · ')
              }
            />
          )}
          {txn.status !== 'void' && (
            <Button variant="danger" size="sm" onClick={() => setShowVoidDialog(true)}>
              <Ban className="h-4 w-4 mr-1" /> Void
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">Details</h2>
          <div className="text-sm space-y-2">
            {headerFields.map((f) => (
              <p key={f.key}><span className="text-gray-500">{f.label}:</span> {fieldValue(f)}</p>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Journal Lines</h2>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-gray-500">Account</th>
                <th className="text-left py-2 text-gray-500">Description</th>
                {showLineName && <th className="text-left py-2 text-gray-500">Name</th>}
                {showLineTag && <th className="text-left py-2 text-gray-500">Tag</th>}
                <th className="text-right py-2 text-gray-500">Debit</th>
                <th className="text-right py-2 text-gray-500">Credit</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id} className="border-b border-gray-100">
                  <td className="py-2">
                    <span className="text-sm text-gray-900">{line.accountName || 'Unknown'}</span>
                    {line.accountNumber && <span className="text-xs text-gray-400 ml-1">({line.accountNumber})</span>}
                  </td>
                  <td className="py-2 text-gray-600">{line.description || '—'}</td>
                  {showLineName && <td className="py-2 text-gray-600">{line.contactName || ''}</td>}
                  {showLineTag && <td className="py-2 text-gray-600">{line.tagName || ''}</td>}
                  <td className="py-2 text-right font-mono">{parseFloat(line.debit) > 0 ? `$${parseFloat(line.debit).toFixed(2)}` : ''}</td>
                  <td className="py-2 text-right font-mono">{parseFloat(line.credit) > 0 ? `$${parseFloat(line.credit).toFixed(2)}` : ''}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-medium">
                <td colSpan={2 + (showLineName ? 1 : 0) + (showLineTag ? 1 : 0)} className="py-2">Totals</td>
                <td className="py-2 text-right font-mono">${lines.reduce((s, l) => s + parseFloat(l.debit), 0).toFixed(2)}</td>
                <td className="py-2 text-right font-mono">${lines.reduce((s, l) => s + parseFloat(l.credit), 0).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <RelatedTransactionsCard transactionId={txn.id} />

      {/* Attachments. AJE files are stored under 'journal_entry' (the AJE
          form and the tb routes both write that), not under 'aje'. */}
      <div className="mt-6">
        <AttachmentPanel attachableType={txn.txnType === 'aje' ? 'journal_entry' : txn.txnType} attachableId={txn.id} />
      </div>

      {/* Void dialog */}
      {showVoidDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="text-lg font-semibold">Void Transaction</h2>
            <p className="text-sm text-gray-600">This will create reversing journal entries. This cannot be undone.</p>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason for voiding..."
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              rows={3}
              required
            />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowVoidDialog(false)}>Cancel</Button>
              <Button variant="danger" onClick={handleVoid} disabled={!voidReason.trim()} loading={voidTxn.isPending}>Void</Button>
            </div>
          </div>
        </div>
      )}

      {showRecurring && (
        <RecurringScheduleModal transactionId={txn.id} onClose={() => setShowRecurring(false)} />
      )}
    </div>
  );
}
