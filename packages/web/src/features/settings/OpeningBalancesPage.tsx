import { useState, useRef, type ChangeEvent } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient, getAccessToken } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Upload, FileSpreadsheet, CheckCircle } from 'lucide-react';

interface Account {
  id: string;
  accountNumber: string | null;
  name: string;
  accountType: string;
  balance: string;
}

interface ParsedRow {
  accountNumber: string;
  accountName: string;
  balance: string;
}

interface ImportResult {
  linesCreated: number;
  transactionId: string;
}

type Mode = 'csv' | 'manual';

function parseCsv(text: string): ParsedRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i]!.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length >= 3) {
      rows.push({
        accountNumber: cols[0] || '',
        accountName: cols[1] || '',
        balance: cols[2] || '0',
      });
    }
  }
  return rows;
}

export function OpeningBalancesPage() {
  const [mode, setMode] = useState<Mode>('csv');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [manualBalances, setManualBalances] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: accountsData, isLoading, isError, refetch } = useQuery({
    queryKey: ['accounts', { limit: 500 }],
    queryFn: () =>
      apiClient<{ data: Account[]; total: number }>('/accounts?limit=500&isActive=true'),
  });

  const importCsv = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);

      const token = getAccessToken();
      const res = await fetch('/api/v1/export/opening-balances', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: 'Import failed' } }));
        throw new Error(err.error?.message || 'Import failed');
      }

      return res.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const importManual = useMutation({
    mutationFn: (balances: Array<{ accountId: string; balance: string }>) =>
      apiClient<ImportResult>('/export/opening-balances', {
        method: 'POST',
        body: JSON.stringify({ balances }),
      }),
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setParsedRows([]);
    setResult(null);

    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const rows = parseCsv(text);
        setParsedRows(rows);
      };
      reader.readAsText(file);
    }
  };

  const handleCsvImport = () => {
    if (!selectedFile) return;
    importCsv.mutate(selectedFile);
  };

  const handleManualImport = () => {
    const balances = Object.entries(manualBalances)
      .filter(([, val]) => val && parseFloat(val) !== 0)
      .map(([accountId, balance]) => ({ accountId, balance }));

    if (balances.length === 0) return;
    importManual.mutate(balances);
  };

  const handleManualBalanceChange = (accountId: string, value: string) => {
    setManualBalances((prev) => ({ ...prev, [accountId]: value }));
  };

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;

  const accounts = accountsData?.data || [];

  if (result) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Opening Balances</h1>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-800">Import Successful</h2>
          </div>
          <p className="text-sm text-gray-600 mb-2">
            {result.linesCreated} journal lines created.
          </p>
          <p className="text-sm text-gray-600 mb-4">
            Transaction ID:{' '}
            <Link
              to={`/transactions/${result.transactionId}`}
              className="text-primary-600 hover:underline font-mono"
            >
              {result.transactionId}
            </Link>
          </p>
          <Button
            variant="secondary"
            onClick={() => {
              setResult(null);
              setParsedRows([]);
              setSelectedFile(null);
              setManualBalances({});
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          >
            Import More
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Opening Balances</h1>

      {/* Mode selector */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={mode === 'csv' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setMode('csv')}
        >
          <Upload className="h-4 w-4 mr-1" /> Upload CSV
        </Button>
        <Button
          variant={mode === 'manual' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setMode('manual')}
        >
          <FileSpreadsheet className="h-4 w-4 mr-1" /> Manual Entry
        </Button>
      </div>

      {(importCsv.error || importManual.error) && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {(importCsv.error || importManual.error)?.message}
        </div>
      )}

      {/* CSV Mode */}
      {mode === 'csv' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Upload CSV</h2>
          <p className="text-sm text-gray-500 mb-4">
            Upload a CSV file with columns: Account Number, Account Name, Balance.
            The first row should be a header row.
          </p>

          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-300 file:text-sm file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-50"
            />
          </div>

          {parsedRows.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Preview ({parsedRows.length} rows)
              </h3>
              <div className="max-h-64 overflow-auto border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Account Number
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Account Name
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsedRows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-900 font-mono">{row.accountNumber}</td>
                        <td className="px-4 py-2 text-gray-700">{row.accountName}</td>
                        <td className="px-4 py-2 text-gray-900 text-right font-mono">{row.balance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Button
            onClick={handleCsvImport}
            loading={importCsv.isPending}
            disabled={!selectedFile || parsedRows.length === 0}
          >
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
        </div>
      )}

      {/* Manual Mode */}
      {mode === 'manual' && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Manual Entry</h2>
          <p className="text-sm text-gray-500 mb-4">
            Enter the opening balance for each account. Leave blank or zero to skip an account.
          </p>

          {accounts.length === 0 ? (
            <p className="text-sm text-gray-500">
              No active accounts found. Create accounts in the Chart of Accounts first.
            </p>
          ) : (
            <>
              <div className="max-h-96 overflow-auto border border-gray-200 rounded-lg mb-4">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Account #
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Account Name
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {accounts.map((acct) => (
                      <tr key={acct.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-500 font-mono">
                          {acct.accountNumber || '—'}
                        </td>
                        <td className="px-4 py-2 text-gray-900">{acct.name}</td>
                        <td className="px-4 py-2 text-gray-500">{acct.accountType}</td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={manualBalances[acct.id] || ''}
                            onChange={(e) => handleManualBalanceChange(acct.id, e.target.value)}
                            className="w-32 text-right rounded-lg border border-gray-300 px-3 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Button
                onClick={handleManualImport}
                loading={importManual.isPending}
                disabled={
                  Object.values(manualBalances).filter((v) => v && parseFloat(v) !== 0).length === 0
                }
              >
                <Upload className="h-4 w-4 mr-1" /> Import
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
