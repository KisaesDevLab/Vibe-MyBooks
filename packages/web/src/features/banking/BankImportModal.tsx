// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useImportBankFile } from '../../api/hooks/useBanking';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toaster';
import { X } from 'lucide-react';

interface BankImportModalProps { onClose: () => void }

export function BankImportModal({ onClose }: BankImportModalProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState('');
  const [preview, setPreview] = useState<string[][]>([]);
  const [mapping, setMapping] = useState({ date: 0, description: 1, amount: 2 });
  // Optional import window — only transactions in [startDate, endDate] are imported.
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const importFile = useImportBankFile();
  const dateRangeInvalid = !!startDate && !!endDate && startDate > endDate;

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    if (f.name.toLowerCase().endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const lines = (ev.target?.result as string).split('\n').filter((l) => l.trim());
        setPreview(lines.slice(0, 6).map((l) => l.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))));
      };
      reader.readAsText(f);
    } else {
      setPreview([]);
    }
  };

  const handleImport = () => {
    if (!file || !accountId || dateRangeInvalid) return;
    importFile.mutate(
      { file, accountId, mapping, startDate: startDate || undefined, endDate: endDate || undefined },
      {
        onSuccess: (data) => {
          // Subtle degradation warning: the rows imported fine, but the AI
          // description cleanup failed and regex-only cleaning was used.
          if ((data.cleansing?.aiFailed ?? 0) > 0) {
            const n = data.cleansing!.aiFailed;
            toast.info(
              `AI cleanup unavailable — ${n} description${n === 1 ? '' : 's'} kept regex-only cleaning.`,
              { detail: data.cleansing!.firstError },
            );
          }
          onClose();
          navigate('/banking/feed');
        },
      },
    );
  };

  const isCsv = file?.name.toLowerCase().endsWith('.csv');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Import Bank Transactions</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-4 overflow-auto flex-1">
          <AccountSelector label="Bank Account" value={accountId} onChange={setAccountId} accountTypeFilter={['asset', 'liability']} required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File (CSV, OFX, QFX)</label>
            <input type="file" accept=".csv,.ofx,.qfx" onChange={handleFileChange} className="text-sm" />
          </div>

          {/* Optional import date range — limits which transactions are imported. */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Import date range <span className="font-normal text-gray-400">(optional)</span></label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From</label>
                <input type="date" value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)}
                  className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To</label>
                <input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)}
                  className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
              </div>
            </div>
            {dateRangeInvalid
              ? <p className="text-xs text-red-600 mt-1">From date must be on or before the To date.</p>
              : <p className="text-xs text-gray-400 mt-1">Leave blank to import all transactions in the file.</p>}
          </div>

          {isCsv && preview.length > 0 && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Date Column</label>
                  <select value={mapping.date} onChange={(e) => setMapping((m) => ({ ...m, date: +e.target.value }))}
                    className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
                    {preview[0]?.map((_, i) => <option key={i} value={i}>Column {i + 1}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description Column</label>
                  <select value={mapping.description} onChange={(e) => setMapping((m) => ({ ...m, description: +e.target.value }))}
                    className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
                    {preview[0]?.map((_, i) => <option key={i} value={i}>Column {i + 1}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Amount Column</label>
                  <select value={mapping.amount} onChange={(e) => setMapping((m) => ({ ...m, amount: +e.target.value }))}
                    className="block w-full rounded border border-gray-300 px-2 py-1.5 text-sm">
                    {preview[0]?.map((_, i) => <option key={i} value={i}>Column {i + 1}</option>)}
                  </select>
                </div>
              </div>
              <div className="border rounded-lg overflow-auto max-h-40">
                <table className="min-w-full text-xs">
                  <tbody className="divide-y divide-gray-200">
                    {preview.map((row, i) => (
                      <tr key={i} className={i === 0 ? 'bg-gray-50 font-medium' : ''}>
                        {row.map((cell, j) => <td key={j} className="px-3 py-1">{cell}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleImport} disabled={!file || !accountId || dateRangeInvalid} loading={importFile.isPending}>Import</Button>
        </div>
      </div>
    </div>
  );
}
