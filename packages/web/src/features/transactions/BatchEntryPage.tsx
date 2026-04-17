// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useCallback, type ChangeEvent, type ClipboardEvent } from 'react';
import { useValidateBatch, useSaveBatch, useParseCsv } from '../../api/hooks/useBatch';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { ContactSelector, type ContactSelection } from '../../components/forms/ContactSelector';
import { Button } from '../../components/ui/Button';
import { useAccounts } from '../../api/hooks/useAccounts';
import { useContacts } from '../../api/hooks/useContacts';
import { Check, X as XIcon, AlertTriangle, Upload, Trash2, CheckCircle } from 'lucide-react';

interface GridRow {
  rowNumber: number;
  date: string;
  refNo: string;
  contactName: string;
  contactId: string;
  accountName: string;
  accountId: string;
  memo: string;
  amount: string;
  debit: string;
  credit: string;
  description: string;
  dueDate: string;
  invoiceNo: string;
  // Validation state
  status?: 'valid' | 'invalid' | 'warning';
  errors?: Array<{ field: string; message: string }>;
}

const txnTypes = [
  { value: 'expense', label: 'Expenses / Checks', needsAccount: true },
  { value: 'deposit', label: 'Deposits', needsAccount: true },
  { value: 'credit_card_charge', label: 'Credit Card Charges', needsAccount: true },
  { value: 'credit_card_credit', label: 'Credit Card Credits', needsAccount: true },
  { value: 'invoice', label: 'Invoices', needsAccount: false },
  { value: 'bill', label: 'Bills', needsAccount: false },
  { value: 'credit_memo', label: 'Credit Memos', needsAccount: false },
  { value: 'journal_entry', label: 'Journal Entries', needsAccount: false },
  { value: 'customer_payment', label: 'Customer Payments', needsAccount: true },
];

const columnsByType: Record<string, Array<{ key: keyof GridRow; label: string; required?: boolean; width: string }>> = {
  expense: [
    { key: 'date', label: 'Date', required: true, width: 'w-28' },
    { key: 'refNo', label: 'Ref No.', width: 'w-20' },
    { key: 'contactName', label: 'Payee', width: 'w-36' },
    { key: 'accountName', label: 'Account', required: true, width: 'w-36' },
    { key: 'memo', label: 'Memo', width: 'w-48' },
    { key: 'amount', label: 'Amount', required: true, width: 'w-24' },
  ],
  deposit: [
    { key: 'date', label: 'Date', required: true, width: 'w-28' },
    { key: 'refNo', label: 'Ref No.', width: 'w-20' },
    { key: 'contactName', label: 'Received From', width: 'w-36' },
    { key: 'accountName', label: 'Account', required: true, width: 'w-36' },
    { key: 'memo', label: 'Memo', width: 'w-48' },
    { key: 'amount', label: 'Amount', required: true, width: 'w-24' },
  ],
  credit_card_charge: [
    { key: 'date', label: 'Date', required: true, width: 'w-28' },
    { key: 'contactName', label: 'Payee', width: 'w-36' },
    { key: 'accountName', label: 'Account', required: true, width: 'w-36' },
    { key: 'memo', label: 'Memo', width: 'w-48' },
    { key: 'amount', label: 'Amount', required: true, width: 'w-24' },
  ],
  credit_card_credit: [
    { key: 'date', label: 'Date', required: true, width: 'w-28' },
    { key: 'contactName', label: 'Payee', width: 'w-36' },
    { key: 'accountName', label: 'Account', required: true, width: 'w-36' },
    { key: 'memo', label: 'Memo', width: 'w-48' },
    { key: 'amount', label: 'Amount', required: true, width: 'w-24' },
  ],
  invoice: [
    { key: 'date', label: 'Date', required: true, width: 'w-28' },
    { key: 'invoiceNo', label: 'Invoice No.', width: 'w-24' },
    { key: 'contactName', label: 'Customer', required: true, width: 'w-36' },
    { key: 'dueDate', label: 'Due Date', width: 'w-28' },
    { key: 'accountName', label: 'Account', required: true, width: 'w-36' },
    { key: 'description', label: 'Description', width: 'w-40' },
    { key: 'amount', label: 'Amount', required: true, width: 'w-24' },
  ],
  bill: [
    { key: 'date', label: 'Bill Date', required: true, width: 'w-28' },
    { key: 'invoiceNo', label: 'Vendor Inv #', width: 'w-24' },
    { key: 'contactName', label: 'Vendor', required: true, width: 'w-36' },
    { key: 'dueDate', label: 'Due Date', width: 'w-28' },
    { key: 'accountName', label: 'Expense Account', required: true, width: 'w-36' },
    { key: 'description', label: 'Description', width: 'w-40' },
    { key: 'amount', label: 'Amount', required: true, width: 'w-24' },
  ],
  credit_memo: [
    { key: 'date', label: 'Date', required: true, width: 'w-28' },
    { key: 'contactName', label: 'Customer', required: true, width: 'w-36' },
    { key: 'accountName', label: 'Account', required: true, width: 'w-36' },
    { key: 'description', label: 'Description', width: 'w-40' },
    { key: 'amount', label: 'Amount', required: true, width: 'w-24' },
  ],
  journal_entry: [
    { key: 'date', label: 'Date', required: true, width: 'w-28' },
    { key: 'refNo', label: 'Ref No.', width: 'w-20' },
    { key: 'accountName', label: 'Account', required: true, width: 'w-36' },
    { key: 'contactName', label: 'Name', width: 'w-36' },
    { key: 'memo', label: 'Memo', width: 'w-48' },
    { key: 'debit', label: 'Debit', width: 'w-24' },
    { key: 'credit', label: 'Credit', width: 'w-24' },
  ],
  customer_payment: [
    { key: 'date', label: 'Date', required: true, width: 'w-28' },
    { key: 'contactName', label: 'Customer', required: true, width: 'w-36' },
    { key: 'invoiceNo', label: 'Invoice No.', width: 'w-24' },
    { key: 'amount', label: 'Amount', required: true, width: 'w-24' },
    { key: 'refNo', label: 'Ref No.', width: 'w-20' },
    { key: 'memo', label: 'Memo', width: 'w-48' },
  ],
};

function emptyRow(n: number): GridRow {
  return { rowNumber: n, date: '', refNo: '', contactName: '', contactId: '', accountName: '', accountId: '', memo: '', amount: '', debit: '', credit: '', description: '', dueDate: '', invoiceNo: '' };
}

export function BatchEntryPage() {
  const [txnType, setTxnType] = useState('expense');
  const [contextAccountId, setContextAccountId] = useState('');
  const [autoCreateContacts, setAutoCreateContacts] = useState(true);
  const [rows, setRows] = useState<GridRow[]>(() => Array.from({ length: 10 }, (_, i) => emptyRow(i + 1)));
  const [showResult, setShowResult] = useState<{ savedCount: number; createdContacts: Array<{ displayName: string }> } | null>(null);

  const validateBatch = useValidateBatch();
  const saveBatch = useSaveBatch();
  const parseCsv = useParseCsv();

  // Lookup maps for resolving IDs to names
  const { data: accountsData } = useAccounts({ isActive: true, limit: 200, offset: 0 });
  const { data: contactsData } = useContacts({ isActive: true, limit: 200, offset: 0 });
  const accountNameMap = new Map((accountsData?.data || []).map((a) => [a.id, a.name]));
  const contactNameMap = new Map((contactsData?.data || []).map((c) => [c.id, c.displayName]));

  const columns = columnsByType[txnType] || columnsByType['expense']!;
  const needsAccount = txnTypes.find((t) => t.value === txnType)?.needsAccount || false;

  const updateCell = (rowIdx: number, key: keyof GridRow, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx]!, [key]: value };
      // Auto-extend when any field on the last row gets a value
      if (rowIdx >= next.length - 1 && value) {
        next.push(emptyRow(next.length + 1));
      }
      return next;
    });
  };

  const addRows = (count: number) => {
    setRows((prev) => {
      const start = prev.length + 1;
      const newRows = Array.from({ length: count }, (_, i) => emptyRow(start + i));
      return [...prev, ...newRows];
    });
  };

  const deleteRow = (idx: number) => {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length === 0 ? [emptyRow(1)] : next.map((r, i) => ({ ...r, rowNumber: i + 1 }));
    });
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !text.includes('\n')) return; // Single cell paste, let default handle it

    e.preventDefault();
    const pastedRows = text.split('\n').filter((l) => l.trim()).map((line) => line.split('\t'));

    setRows((prev) => {
      const next = [...prev];
      for (let i = 0; i < pastedRows.length; i++) {
        const cols = pastedRows[i]!;
        const rowIdx = i;
        if (rowIdx >= next.length) next.push(emptyRow(next.length + 1));
        const row = next[rowIdx]!;

        columns.forEach((col, ci) => {
          if (cols[ci] !== undefined) {
            (row as any)[col.key] = cols[ci]!.trim();
          }
        });
      }
      next.push(emptyRow(next.length + 1)); // ensure blank at end
      return next;
    });
  }, [columns]);

  // Convert grid rows to batch API format, resolving IDs to names
  const prepareRows = (sourceRows: GridRow[]) =>
    sourceRows.filter((r) => r.date || r.amount || r.contactId || r.accountId || r.contactName || r.accountName)
      .map((r) => ({
        rowNumber: r.rowNumber,
        date: r.date,
        refNo: r.refNo,
        contactName: r.contactId ? (contactNameMap.get(r.contactId) || r.contactName) : r.contactName,
        accountName: r.accountId ? (accountNameMap.get(r.accountId) || r.accountName) : r.accountName,
        memo: r.memo,
        amount: parseFloat(r.amount) || undefined,
        debit: parseFloat(r.debit) || undefined,
        credit: parseFloat(r.credit) || undefined,
        description: r.description,
        dueDate: r.dueDate,
        invoiceNo: r.invoiceNo,
      }));

  const handleValidate = () => {
    validateBatch.mutate({
      txn_type: txnType,
      context_account_id: contextAccountId || null,
      rows: prepareRows(rows),
    }, {
      onSuccess: (result) => {
        setRows((prev) => prev.map((row) => {
          const vr = result.rows.find((r) => r.rowNumber === row.rowNumber);
          if (!vr) return row;
          return { ...row, status: vr.status, errors: vr.errors };
        }));
      },
    });
  };

  const handleSave = () => {
    saveBatch.mutate({
      txn_type: txnType,
      context_account_id: contextAccountId || null,
      auto_create_contacts: autoCreateContacts,
      rows: prepareRows(rows),
    }, {
      onSuccess: (result) => setShowResult(result),
    });
  };

  const handleCsvImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseCsv.mutate({ file, txnType }, {
      onSuccess: (result) => {
        const imported = result.rows.map((r: any, i: number) => ({
          ...emptyRow(i + 1),
          date: r.date || '',
          refNo: r.refNo || r.ref_no || '',
          contactName: r.contactName || r.contact_name || '',
          accountName: r.accountName || r.account_name || '',
          memo: r.memo || '',
          amount: String(r.amount || ''),
          debit: String(r.debit || ''),
          credit: String(r.credit || ''),
          description: r.description || '',
        }));
        imported.push(emptyRow(imported.length + 1));
        setRows(imported);
      },
    });
  };

  const filledRows = rows.filter((r) => r.date || r.amount || r.debit || r.credit || r.contactId || r.accountId);
  const validCount = filledRows.filter((r) => r.status === 'valid' || r.status === 'warning').length;
  const invalidCount = filledRows.filter((r) => r.status === 'invalid').length;
  const batchTotal = filledRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const isJE = txnType === 'journal_entry';
  const totalDebits = isJE ? filledRows.reduce((s, r) => s + (parseFloat(r.debit) || 0), 0) : 0;
  const totalCredits = isJE ? filledRows.reduce((s, r) => s + (parseFloat(r.credit) || 0), 0) : 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Batch Entry</h1>

      {/* Toolbar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4 flex-wrap">
        <select value={txnType} onChange={(e) => { setTxnType(e.target.value); setRows(Array.from({ length: 10 }, (_, i) => emptyRow(i + 1))); }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium">
          {txnTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>

        {needsAccount && (
          <div className="w-64">
            <AccountSelector value={contextAccountId} onChange={setContextAccountId}
              label="" accountTypeFilter={['asset', 'liability']} required />
          </div>
        )}

        <span className="text-xs text-gray-500">
          {filledRows.length} rows
          {validCount > 0 && <span className="text-green-600 ml-1">— {validCount} valid</span>}
          {invalidCount > 0 && <span className="text-red-600 ml-1">, {invalidCount} errors</span>}
        </span>

        <div className="ml-auto flex gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-500">
            <input type="checkbox" checked={autoCreateContacts} onChange={(e) => setAutoCreateContacts(e.target.checked)} className="rounded" />
            Auto-add contacts
          </label>

          <label className="cursor-pointer">
            <input type="file" accept=".csv,.tsv,.txt" onChange={handleCsvImport} className="hidden" />
            <span className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
              <Upload className="h-3 w-3" /> CSV
            </span>
          </label>

          <Button variant="secondary" size="sm" onClick={handleValidate} loading={validateBatch.isPending}>
            Validate
          </Button>
          <Button size="sm" onClick={handleSave} loading={saveBatch.isPending}
            disabled={needsAccount && !contextAccountId}>
            Save All
          </Button>
        </div>
      </div>

      {/* Validation errors */}
      {saveBatch.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          {saveBatch.error.message}
        </div>
      )}

      {/* Grid */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto" onPaste={handlePaste}>
        <table className="min-w-full text-xs" style={{ borderCollapse: 'collapse' }}>
          <thead className="bg-gray-100 sticky top-0 z-10 border-b border-gray-300">
            <tr>
              <th className="w-8 px-1 py-2.5 text-center text-gray-400 border-r border-gray-200">#</th>
              <th className="w-6 px-1 py-2.5 border-r border-gray-200" />
              {columns.map((col) => (
                <th key={col.key} className={`${col.width} px-2 py-2.5 text-left text-gray-600 font-semibold text-[11px] uppercase tracking-wide border-r border-gray-200`}>
                  {col.label}{col.required && <span className="text-red-400 ml-0.5">*</span>}
                </th>
              ))}
              <th className="w-8 px-1 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const rowErrors = row.errors || [];
              const errorFields = new Set(rowErrors.map((e) => e.field));

              return (
                <tr key={rowIdx} className={`${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'} hover:bg-blue-50/30`} style={{ height: '34px' }}>
                  <td className="px-1 text-center text-gray-300 font-mono">{row.rowNumber}</td>
                  <td className="px-1 text-center">
                    {row.status === 'valid' && <Check className="h-3 w-3 text-green-500 inline" />}
                    {row.status === 'invalid' && <XIcon className="h-3 w-3 text-red-500 inline" />}
                    {row.status === 'warning' && <AlertTriangle className="h-3 w-3 text-amber-500 inline" />}
                  </td>
                  {columns.map((col) => {
                    const hasError = errorFields.has(col.key) || errorFields.has(col.key.replace(/([A-Z])/g, '_$1').toLowerCase());
                    const cellError = rowErrors.find((e) => e.field === col.key || e.field === col.key.replace(/([A-Z])/g, '_$1').toLowerCase());
                    const cellBorder = hasError ? 'border-red-400 bg-red-50' : 'border-gray-200';

                    // Contact dropdown cell
                    if (col.key === 'contactName') {
                      const isCustomer = ['invoice', 'credit_memo', 'customer_payment'].includes(txnType);
                      return (
                        <td key={col.key} className="px-px" title={cellError?.message}>
                          <ContactSelector
                            value={row.contactId}
                            onChange={(id) => { updateCell(rowIdx, 'contactId', id); }}
                            onSelect={(c) => { if (c?.defaultExpenseAccountId && !row.accountId) updateCell(rowIdx, 'accountId', c.defaultExpenseAccountId); }}
                            contactTypeFilter={isCustomer ? 'customer' : 'vendor'}
                            compact
                          />
                        </td>
                      );
                    }

                    // Account dropdown cell
                    if (col.key === 'accountName') {
                      const accountFilter = txnType === 'expense' || txnType === 'credit_card_charge' || txnType === 'bill' ? 'expense' as const
                        : txnType === 'deposit' ? 'revenue' as const
                        : undefined;
                      return (
                        <td key={col.key} className="px-px" title={cellError?.message}>
                          <AccountSelector
                            value={row.accountId}
                            onChange={(id) => { updateCell(rowIdx, 'accountId', id); }}
                            accountTypeFilter={accountFilter}
                            compact
                          />
                        </td>
                      );
                    }

                    return (
                      <td key={col.key} className="px-px" title={cellError?.message}>
                        <input
                          value={(row as any)[col.key] || ''}
                          onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                          type={col.key === 'date' || col.key === 'dueDate' ? 'date' : 'text'}
                          className={`w-full px-1.5 py-1 rounded border text-xs ${cellBorder}
                          focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 ${
                            col.key === 'amount' || col.key === 'debit' || col.key === 'credit' ? 'text-right font-mono' : ''
                          }`}
                        />
                      </td>
                    );
                  })}
                  <td className="px-1">
                    <button onClick={() => deleteRow(rowIdx)} className="text-gray-300 hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 font-medium">
            <tr>
              <td colSpan={2 + columns.length - 1} className="px-2 py-2 text-right text-gray-600">
                Total:
              </td>
              <td className="px-2 py-2 text-right font-mono">
                {isJE ? `D: $${totalDebits.toFixed(2)} | C: $${totalCredits.toFixed(2)}` : `$${batchTotal.toFixed(2)}`}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add Rows */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => addRows(10)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors"
        >
          + Add 10 rows
        </button>
        <button
          onClick={() => addRows(25)}
          className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          +25
        </button>
        <button
          onClick={() => addRows(50)}
          className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          +50
        </button>
        <button
          onClick={() => addRows(100)}
          className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          +100
        </button>
        <span className="text-xs text-gray-400">{rows.length} rows</span>
      </div>

      {/* Save Result Modal */}
      {showResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-lg font-semibold">{showResult.savedCount} Transactions Saved</h2>
            {showResult.createdContacts.length > 0 && (
              <p className="text-sm text-gray-600">
                Created {showResult.createdContacts.length} new contacts: {showResult.createdContacts.map((c) => c.displayName).join(', ')}
              </p>
            )}
            <div className="flex justify-center gap-3 pt-2">
              <Button variant="secondary" onClick={() => { setShowResult(null); setRows(Array.from({ length: 10 }, (_, i) => emptyRow(i + 1))); }}>
                Enter Another Batch
              </Button>
              <Button onClick={() => { setShowResult(null); window.location.href = '/transactions'; }}>
                View Transactions
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
