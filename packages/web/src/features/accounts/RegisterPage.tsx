// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRegister, useRegisterSummary } from '../../api/hooks/useRegister';
import { useVoidTransaction } from '../../api/hooks/useTransactions';
import { AccountSwitcher } from './AccountSwitcher';
import { RegisterEntryRow } from './RegisterEntryRow';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Search, Download, Printer, ChevronLeft, ChevronRight, Ban } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const txnTypeLabels: Record<string, string> = {
  invoice: 'INV', customer_payment: 'PMT', cash_sale: 'SALE', expense: 'CHK',
  deposit: 'DEP', transfer: 'XFR', journal_entry: 'JE', credit_memo: 'CM', customer_refund: 'REF',
};

function fmt(n: number | null) {
  if (n === null) return '';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const datePresets = [
  { label: 'Last 90 Days', fn: () => { const e = new Date(); const s = new Date(e.getTime() - 90*86400000); return { s: s.toISOString().split('T')[0]!, e: e.toISOString().split('T')[0]! }; }},
  { label: 'This Month', fn: () => { const d = new Date(); return { s: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`, e: d.toISOString().split('T')[0]! }; }},
  { label: 'This Year', fn: () => { const d = new Date(); return { s: `${d.getFullYear()}-01-01`, e: d.toISOString().split('T')[0]! }; }},
  { label: 'All', fn: () => ({ s: '2000-01-01', e: '2099-12-31' }) },
];

export function RegisterPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const today = new Date().toISOString().split('T')[0]!;
  const ninetyAgo = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]!;

  const [startDate, setStartDate] = useState(ninetyAgo);
  const [endDate, setEndDate] = useState(today);
  const [search, setSearch] = useState('');
  const [txnTypeFilter, setTxnTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortDir, setSortDir] = useState<string>('desc');
  const [page, setPage] = useState(1);
  const [includeVoid, setIncludeVoid] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const { data, isLoading, isError, refetch } = useRegister(id!, {
    startDate, endDate, search: search || undefined, txnType: txnTypeFilter || undefined,
    sortBy: sortBy as any, sortDir: sortDir as any, page, perPage: 50, includeVoid,
  });
  const { data: summary } = useRegisterSummary(id!);
  const voidTxn = useVoidTransaction();

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError || !data) return <ErrorMessage onRetry={() => refetch()} />;

  const { account, lines, balanceForward, endingBalance, pagination, allowedEntryTypes } = data;
  const isBankOrCC = account.detailType === 'bank' || account.detailType === 'credit_card';
  const paymentLabel = isBankOrCC ? 'Payment' : 'Decrease';
  const depositLabel = isBankOrCC ? 'Deposit' : 'Increase';

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const handlePrint = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
    const pageW = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(14);
    doc.text(`${account.name} Register`, 40, 36);
    doc.setFontSize(9);
    doc.setTextColor(100);
    const subtitle = `${account.detailType?.replace(/_/g, ' ') || account.accountType}${account.accountNumber ? ' #' + account.accountNumber : ''}  |  ${startDate} to ${endDate}`;
    doc.text(subtitle, 40, 50);
    doc.setTextColor(0);

    // Table data
    const tableHead = [['Date', 'Type', 'Payee', 'Account', 'Memo', paymentLabel, depositLabel, 'Balance']];
    const tableBody = lines.map((l) => [
      l.txnDate,
      `${txnTypeLabels[l.txnType] || l.txnType}${l.txnNumber ? ' #' + l.txnNumber : ''}${l.status === 'void' ? ' VOID' : ''}`,
      l.payeeName || '',
      l.accountName || '',
      l.memo || '',
      l.payment ? fmt(l.payment) : '',
      l.deposit ? fmt(l.deposit) : '',
      fmt(l.runningBalance),
    ]);

    // Footer row
    const footRow = [
      { content: `${lines.length} of ${pagination.totalRows} transactions`, colSpan: 5, styles: { fontStyle: 'bold' as const } },
      { content: totalPayments > 0 ? fmt(totalPayments) : '', styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
      { content: totalDeposits > 0 ? fmt(totalDeposits) : '', styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
      { content: fmt(endingBalance), styles: { halign: 'right' as const, fontStyle: 'bold' as const } },
    ];

    autoTable(doc, {
      startY: 60,
      head: tableHead,
      body: tableBody,
      foot: [footRow],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [240, 240, 240], textColor: [60, 60, 60], fontStyle: 'bold', fontSize: 7 },
      footStyles: { fillColor: [245, 245, 245], textColor: [30, 30, 30] },
      columnStyles: {
        0: { cellWidth: 58 },
        1: { cellWidth: 52 },
        5: { halign: 'right', cellWidth: 62 },
        6: { halign: 'right', cellWidth: 62 },
        7: { halign: 'right', cellWidth: 68, fontStyle: 'bold' },
      },
      bodyStyles: { textColor: [40, 40, 40] },
      didParseCell: (data) => {
        // Red for negative balances
        if (data.section === 'body' && data.column.index === 7) {
          const raw = lines[data.row.index];
          if (raw && raw.runningBalance < 0) {
            data.cell.styles.textColor = [200, 0, 0];
          }
        }
        // Gray out void rows
        if (data.section === 'body') {
          const raw = lines[data.row.index];
          if (raw && raw.status === 'void') {
            data.cell.styles.textColor = [170, 170, 170];
          }
        }
      },
      margin: { left: 40, right: 40 },
    });

    // Page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, pageW - 80, doc.internal.pageSize.getHeight() - 20);
    }

    doc.save(`register-${account.name}.pdf`);
  };

  const handleExportCsv = () => {
    const header = `Date,Type,Ref,Payee,Memo,${paymentLabel},${depositLabel},Balance\n`;
    const rows = lines.map((l) =>
      `"${l.txnDate}","${l.txnType}","${l.txnNumber || ''}","${l.payeeName || ''}","${l.memo || ''}","${fmt(l.payment)}","${fmt(l.deposit)}","${fmt(l.runningBalance)}"`,
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `register-${account.name}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleVoid = () => {
    if (!voidingId || !voidReason.trim()) return;
    voidTxn.mutate({ id: voidingId, reason: voidReason }, {
      onSuccess: () => { setVoidingId(null); setVoidReason(''); refetch(); },
    });
  };

  const totalPayments = lines.reduce((s, l) => s + (l.payment || 0), 0);
  const totalDeposits = lines.reduce((s, l) => s + (l.deposit || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <AccountSwitcher currentAccountId={id!} />
          <div>
            <h1 className="text-xl font-bold text-gray-900">{account.name}</h1>
            <span className="text-xs text-gray-500 capitalize">{account.detailType?.replace(/_/g, ' ') || account.accountType} {account.accountNumber && `#${account.accountNumber}`}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Current Balance</p>
          <p className={`text-2xl font-bold font-mono ${(summary?.currentBalance || 0) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
            ${fmt(summary?.currentBalance || 0)}
          </p>
          {summary && summary.unclearedCount > 0 && (
            <p className="text-xs text-gray-400">{summary.unclearedCount} uncleared</p>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap bg-white rounded-lg border border-gray-200 p-3">
        <div className="flex gap-1">
          {datePresets.map((p) => (
            <button key={p.label} onClick={() => { const r = p.fn(); setStartDate(r.s); setEndDate(r.e); setPage(1); }}
              className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50">{p.label}</button>
          ))}
        </div>
        <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
          className="rounded border border-gray-300 px-2 py-1 text-xs" />
        <span className="text-gray-400 text-xs">to</span>
        <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
          className="rounded border border-gray-300 px-2 py-1 text-xs" />
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
          <input placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="rounded border border-gray-300 pl-6 pr-2 py-1 text-xs w-36" />
        </div>
        <select value={txnTypeFilter} onChange={(e) => { setTxnTypeFilter(e.target.value); setPage(1); }}
          className="rounded border border-gray-300 px-2 py-1 text-xs">
          <option value="">All Types</option>
          {Object.entries(txnTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="flex items-center gap-1 text-xs text-gray-500">
          <input type="checkbox" checked={includeVoid} onChange={(e) => setIncludeVoid(e.target.checked)} className="rounded" />
          Void
        </label>
        <div className="ml-auto flex gap-2">
          <button onClick={() => navigate(`/banking/reconcile`)} className="text-xs text-primary-600 hover:underline">Reconcile</button>
          <button onClick={handleExportCsv} className="text-gray-400 hover:text-gray-600"><Download className="h-4 w-4" /></button>
          <button onClick={handlePrint} className="text-gray-400 hover:text-gray-600"><Printer className="h-4 w-4" /></button>
        </div>
      </div>

      {/* Register Entry Form */}
      <RegisterEntryRow accountId={id!} accountType={account.accountType} allowedEntryTypes={allowedEntryTypes} isBankOrCC={isBankOrCC} />

      {/* Register Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase cursor-pointer w-[5.5rem]" onClick={() => toggleSort('date')}>
                Date {sortBy === 'date' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase w-16" onClick={() => toggleSort('type')}>
                Type {sortBy === 'type' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase w-32">Payee</th>
              <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase w-32">Account</th>
              <th className="px-2 py-2 text-left font-medium text-gray-500 uppercase">Memo</th>
              <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase w-24" onClick={() => toggleSort('amount')}>
                {paymentLabel} {sortBy === 'amount' && (sortDir === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase w-24">{depositLabel}</th>
              <th className="px-2 py-2 text-right font-medium text-gray-500 uppercase w-28">Balance</th>
              <th className="px-2 py-2 text-center font-medium text-gray-500 uppercase w-6">✓</th>
            </tr>
          </thead>
          <tbody>
            {/* Balance forward row — top when ascending */}
            {balanceForward !== 0 && sortDir === 'asc' && (
              <tr className="bg-gray-50 text-gray-500 italic">
                <td colSpan={7} className="px-2 py-1">Balance Forward</td>
                <td className="px-2 py-1 text-right font-mono font-bold">${fmt(balanceForward)}</td>
                <td />
              </tr>
            )}

            {/* Transaction rows */}
            {lines.map((line, i) => (
              <tr key={line.lineId}
                className={`${i % 2 === 0 ? '' : 'bg-gray-50/50'} ${line.status === 'void' ? 'line-through text-gray-400' : ''} hover:bg-blue-50 cursor-pointer`}
                style={{ height: '34px' }}
                onClick={() => navigate(`/transactions/${line.transactionId}`)}
              >
                <td className="px-2 py-1 text-gray-700">{line.txnDate}</td>
                <td className="px-2 py-1">
                  <span className="text-gray-500 font-mono">{txnTypeLabels[line.txnType] || line.txnType}</span>
                  {line.txnNumber && <span className="text-gray-400 ml-1">#{line.txnNumber}</span>}
                  {line.status === 'void' && <span className="ml-1 text-xs text-red-500 font-medium">VOID</span>}
                </td>
                <td className="px-2 py-1 text-gray-700 truncate max-w-[120px]">{line.payeeName || ''}</td>
                <td className="px-2 py-1 text-gray-500 truncate max-w-[120px]">{line.accountName || ''}</td>
                <td className="px-2 py-1 text-gray-500 truncate max-w-[200px]">{line.memo || ''}</td>
                <td className="px-2 py-1 text-right font-mono text-gray-700">{line.payment ? fmt(line.payment) : ''}</td>
                <td className="px-2 py-1 text-right font-mono text-gray-700">{line.deposit ? fmt(line.deposit) : ''}</td>
                <td className={`px-2 py-1 text-right font-mono font-bold ${line.runningBalance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {fmt(line.runningBalance)}
                </td>
                <td className="px-2 py-1 text-center text-gray-400">
                  {line.reconciliationStatus === 'reconciled' ? <span className="text-green-600 font-bold">R</span> :
                   line.reconciliationStatus === 'cleared' ? <span className="text-blue-600">C</span> : ''}
                </td>
              </tr>
            ))}

            {/* Balance forward row — bottom when descending */}
            {balanceForward !== 0 && sortDir === 'desc' && (
              <tr className="bg-gray-50 text-gray-500 italic">
                <td colSpan={7} className="px-2 py-1">Balance Forward</td>
                <td className="px-2 py-1 text-right font-mono font-bold">${fmt(balanceForward)}</td>
                <td />
              </tr>
            )}

            {lines.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No transactions found for this period.</td></tr>
            )}
          </tbody>
          <tfoot className="bg-gray-50 font-medium border-t-2">
            <tr>
              <td colSpan={5} className="px-2 py-2 text-gray-700">
                Showing {lines.length} of {pagination.totalRows} transactions
              </td>
              <td className="px-2 py-2 text-right font-mono">{totalPayments > 0 && fmt(totalPayments)}</td>
              <td className="px-2 py-2 text-right font-mono">{totalDeposits > 0 && fmt(totalDeposits)}</td>
              <td className="px-2 py-2 text-right font-mono font-bold">{fmt(endingBalance)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}
            className="p-1 text-gray-500 hover:text-gray-700 disabled:text-gray-300">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm text-gray-600">Page {page} of {pagination.totalPages}</span>
          <button disabled={page >= pagination.totalPages} onClick={() => setPage(page + 1)}
            className="p-1 text-gray-500 hover:text-gray-700 disabled:text-gray-300">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Void dialog */}
      {voidingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="text-lg font-semibold">Void Transaction</h2>
            <textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason..." className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={3} />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setVoidingId(null)}>Cancel</Button>
              <Button variant="danger" onClick={handleVoid} disabled={!voidReason.trim()} loading={voidTxn.isPending}>Void</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
