import { useState, type ChangeEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { useImportAccounts } from '../../api/hooks/useAccounts';
import { X } from 'lucide-react';

interface AccountImportModalProps {
  onClose: () => void;
}

interface ParsedRow {
  name: string;
  accountNumber: string;
  accountType: string;
  detailType: string;
}

export function AccountImportModal({ onClose }: AccountImportModalProps) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [error, setError] = useState('');
  const importAccounts = useImportAccounts();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter((l) => l.trim());
      if (lines.length < 2) {
        setError('CSV must have a header row and at least one data row');
        return;
      }

      const parsed: ParsedRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i]!.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
        if (cols.length >= 2) {
          parsed.push({
            accountNumber: cols[0] || '',
            name: cols[1] || '',
            accountType: (cols[2] || 'expense').toLowerCase(),
            detailType: cols[3] || '',
          });
        }
      }
      setRows(parsed);
      setError('');
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    importAccounts.mutate(
      rows.map((r) => ({
        name: r.name,
        accountNumber: r.accountNumber || undefined,
        accountType: r.accountType,
        detailType: r.detailType || undefined,
      })),
      { onSuccess: onClose },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Import Accounts from CSV</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-4 overflow-auto flex-1">
          <p className="text-sm text-gray-600">
            Upload a CSV with columns: Account Number, Name, Type, Detail Type
          </p>
          <input type="file" accept=".csv" onChange={handleFileChange} className="text-sm" />

          {error && <p className="text-sm text-red-600">{error}</p>}

          {rows.length > 0 && (
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
                    <tr key={i}>
                      <td className="px-4 py-2">{r.accountNumber}</td>
                      <td className="px-4 py-2">{r.name}</td>
                      <td className="px-4 py-2">{r.accountType}</td>
                      <td className="px-4 py-2">{r.detailType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {importAccounts.error && <p className="text-sm text-red-600">{importAccounts.error.message}</p>}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleImport} disabled={rows.length === 0} loading={importAccounts.isPending}>
            Import {rows.length} accounts
          </Button>
        </div>
      </div>
    </div>
  );
}
