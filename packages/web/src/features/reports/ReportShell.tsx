import { useState, type ReactNode } from 'react';
import { Button } from '../../components/ui/Button';
import { Download, FileSpreadsheet } from 'lucide-react';

async function downloadReport(url: string, filename: string) {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

interface ReportShellProps {
  title: string;
  children: ReactNode;
  filters?: ReactNode;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  /** URL-based export: provide a base URL and the shell handles auth + download */
  exportBaseUrl?: string;
  /** Tailwind max-width class. Defaults to 'max-w-5xl'. Use 'max-w-none' for full width. */
  maxWidth?: string;
}

export function ReportShell({ title, children, filters, onExportCsv, onExportPdf, exportBaseUrl, maxWidth = 'max-w-5xl' }: ReportShellProps) {
  const [csvLoading, setCsvLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const hasCsv = !!(onExportCsv || exportBaseUrl);
  const hasPdf = !!(onExportPdf || exportBaseUrl);

  const handleCsv = async () => {
    if (onExportCsv) return onExportCsv();
    if (!exportBaseUrl) return;
    setCsvLoading(true);
    try {
      const sep = exportBaseUrl.includes('?') ? '&' : '?';
      await downloadReport(`${exportBaseUrl}${sep}format=csv`, `${title.replace(/\s+/g, '_')}.csv`);
    } catch { /* ignore */ }
    setCsvLoading(false);
  };

  const handlePdf = async () => {
    if (onExportPdf) return onExportPdf();
    if (!exportBaseUrl) return;
    setPdfLoading(true);
    try {
      const sep = exportBaseUrl.includes('?') ? '&' : '?';
      await downloadReport(`${exportBaseUrl}${sep}format=pdf`, `${title.replace(/\s+/g, '_')}.pdf`);
    } catch { /* ignore */ }
    setPdfLoading(false);
  };

  return (
    <div className={`${maxWidth} mx-auto`}>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <div className="flex gap-2">
          {hasCsv && (
            <Button variant="secondary" size="sm" onClick={handleCsv} loading={csvLoading}>
              <FileSpreadsheet className="h-4 w-4 mr-1" /> CSV
            </Button>
          )}
          {hasPdf && (
            <Button variant="secondary" size="sm" onClick={handlePdf} loading={pdfLoading}>
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
          )}
        </div>
      </div>
      {filters && <div className="mb-4">{filters}</div>}
      {children}
    </div>
  );
}
