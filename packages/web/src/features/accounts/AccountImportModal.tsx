// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState, type ChangeEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { useImportAccounts, type ImportAccountsResult } from '../../api/hooks/useAccounts';
import { ACCOUNT_TYPES, formatAccountTypeLabel } from '@kis-books/shared';
import { X } from 'lucide-react';

interface AccountImportModalProps {
  onClose: () => void;
}

interface ParsedRow {
  name: string;
  accountNumber: string;
  accountType: string;
  detailType: string;
  error: string | null;
}

// A CSV exported from another product spells the type column its own way;
// map the common ones onto our account types so the file doesn't have to be
// hand-edited before it imports.
const TYPE_ALIASES: Record<string, string> = {
  income: 'revenue',
  sales: 'revenue',
  'other income': 'other_revenue',
  'cost of goods sold': 'cogs',
  'cost of sales': 'cogs',
  assets: 'asset',
  liabilities: 'liability',
  expenses: 'expense',
  'other expense': 'other_expense',
};

/**
 * Minimal RFC-4180 split: honours "quoted, fields" and "" escapes, and
 * tolerates the CRLF line endings every spreadsheet writes.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  // Strip a UTF-8 BOM — Excel writes one, and it would otherwise become part
  // of the first header cell.
  const src = text.replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  row.push(field);
  rows.push(row);

  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

export function normalizeType(raw: string): string {
  const cleaned = raw.trim().toLowerCase();
  return TYPE_ALIASES[cleaned] ?? cleaned.replace(/[\s-]+/g, '_');
}

export function AccountImportModal({ onClose }: AccountImportModalProps) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [error, setError] = useState('');
  const [updateExisting, setUpdateExisting] = useState(false);
  const [result, setResult] = useState<ImportAccountsResult | null>(null);
  const importAccounts = useImportAccounts();

  const validRows = rows.filter((r) => !r.error);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const records = parseCsv((event.target?.result as string) ?? '');
      if (records.length < 2) {
        setRows([]);
        setError('CSV must have a header row and at least one data row');
        return;
      }

      const parsed: ParsedRow[] = [];
      for (let i = 1; i < records.length; i++) {
        const cols = records[i]!.map((c) => c.trim());
        if (cols.length < 2) continue;

        const accountNumber = cols[0] || '';
        const name = cols[1] || '';
        const accountType = normalizeType(cols[2] || 'expense');
        const detailType = cols[3] || '';

        let rowError: string | null = null;
        if (!name) {
          rowError = 'Name is required';
        } else if (name.length > 255) {
          rowError = 'Name is longer than 255 characters';
        } else if (accountNumber.length > 20) {
          rowError = 'Account number is longer than 20 characters';
        } else if (!(ACCOUNT_TYPES as string[]).includes(accountType)) {
          rowError = `Unknown type "${cols[2] ?? ''}"`;
        } else if (detailType.length > 100) {
          rowError = 'Detail type is longer than 100 characters';
        }

        parsed.push({ accountNumber, name, accountType, detailType, error: rowError });
      }

      setRows(parsed);
      setError(parsed.length === 0 ? 'No data rows found in this CSV' : '');
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    importAccounts.mutate(
      {
        accounts: validRows.map((r) => ({
          name: r.name,
          accountNumber: r.accountNumber || undefined,
          accountType: r.accountType,
          detailType: r.detailType || undefined,
        })),
        updateExisting,
      },
      { onSuccess: (res) => setResult(res) },
    );
  };

  const invalidCount = rows.length - validRows.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Import Accounts from CSV</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-4 overflow-auto flex-1">
          {result ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-800">
                Imported <strong>{result.imported}</strong> account{result.imported === 1 ? '' : 's'}
                {result.updated > 0 && <> · updated <strong>{result.updated}</strong></>}
                {result.skipped.length > 0 && <> · skipped <strong>{result.skipped.length}</strong></>}.
              </p>
              {result.skipped.length > 0 && (
                <div className="border rounded-lg overflow-auto max-h-64">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left">Row</th>
                        <th className="px-4 py-2 text-left">Number</th>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-left">Why it was skipped</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {result.skipped.map((s) => (
                        <tr key={`${s.row}-${s.accountNumber ?? ''}`}>
                          <td className="px-4 py-2">{s.row}</td>
                          <td className="px-4 py-2">{s.accountNumber ?? ''}</td>
                          <td className="px-4 py-2">{s.name}</td>
                          <td className="px-4 py-2 text-gray-600">{s.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {result.skipped.length > 0 && !updateExisting && (
                <p className="text-sm text-gray-600">
                  Accounts that already exist were left untouched. Re-run with
                  “Overwrite accounts that already exist” to replace them.
                </p>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Upload a CSV with columns: Account Number, Name, Type, Detail Type
              </p>
              <input type="file" accept=".csv" onChange={handleFileChange} className="text-sm" />

              {error && <p className="text-sm text-red-600">{error}</p>}

              {rows.length > 0 && (
                <>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={updateExisting}
                      onChange={(e) => setUpdateExisting(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Overwrite accounts that already exist (matched by account number)
                  </label>

                  {invalidCount > 0 && (
                    <p className="text-sm text-amber-700">
                      {invalidCount} row{invalidCount === 1 ? '' : 's'} can’t be imported and will be
                      left out. Valid types: {ACCOUNT_TYPES.map(formatAccountTypeLabel).join(', ')}.
                    </p>
                  )}

                  <div className="border rounded-lg overflow-auto max-h-64">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left">Number</th>
                          <th className="px-4 py-2 text-left">Name</th>
                          <th className="px-4 py-2 text-left">Type</th>
                          <th className="px-4 py-2 text-left">Detail Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {rows.map((r, i) => (
                          <tr key={i} className={r.error ? 'bg-red-50' : undefined}>
                            <td className="px-4 py-2">{r.accountNumber}</td>
                            <td className="px-4 py-2">{r.name}</td>
                            <td className="px-4 py-2">{r.accountType}</td>
                            <td className="px-4 py-2">
                              {r.detailType}
                              {r.error && <span className="block text-xs text-red-600">{r.error}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {importAccounts.error && <p className="text-sm text-red-600">{importAccounts.error.message}</p>}
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          {result ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button onClick={handleImport} disabled={validRows.length === 0} loading={importAccounts.isPending}>
                Import {validRows.length} accounts
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
