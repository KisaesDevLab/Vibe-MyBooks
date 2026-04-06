import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient, getAccessToken } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Download, FileDown, CheckCircle } from 'lucide-react';

interface ExportResult {
  files: Array<{
    name: string;
    rowCount: number;
  }>;
}

export function DataExportPage() {
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);

  const exportAll = useMutation({
    mutationFn: () => apiClient<ExportResult>('/export/full'),
    onSuccess: (result) => {
      setExportResult(result);
    },
  });

  const handleDownloadFile = (fileName: string) => {
    const token = getAccessToken();
    fetch(`/api/v1/export/download/${encodeURIComponent(fileName)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error('Download failed');
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Export Data</h1>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Full Data Export</h2>
        <p className="text-sm text-gray-500 mb-2">
          Export all your bookkeeping data as CSV files. This includes your chart of accounts,
          contacts, transactions, and journal lines.
        </p>
        <p className="text-sm text-gray-500 mb-4">
          The exported files can be used for migration to another system, offline analysis,
          or as a human-readable backup of your data.
        </p>

        {exportAll.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {exportAll.error.message}
          </div>
        )}

        <Button onClick={() => exportAll.mutate()} loading={exportAll.isPending}>
          <Download className="h-4 w-4 mr-1" /> Export All Data
        </Button>
      </div>

      {exportResult && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-800">Export Complete</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Your data has been exported. Click each file below to download.
          </p>
          <div className="space-y-2">
            {exportResult.files.map((file) => (
              <div
                key={file.name}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <FileDown className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">{file.rowCount} rows</p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleDownloadFile(file.name)}
                >
                  <Download className="h-4 w-4 mr-1" /> Download
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
