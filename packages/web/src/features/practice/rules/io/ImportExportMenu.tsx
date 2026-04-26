// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '../../../../components/ui/Button';
import { useExportCsvRules, useExportJsonRules, useImportRules } from '../../../../api/hooks/useRuleImportExport';

// Phase 5b §5.8 — header dropdown for import/export.
// Export goes through `apiClient` so the auth header is set,
// then triggers a Blob-based download. Import takes a JSON
// file via a hidden file picker; the bundle is parsed +
// validated server-side.
//
// QBO CSV import is a stub explaining the format isn't yet
// documented; users are nudged toward JSON import.
export function ImportExportMenu() {
  const exportJson = useExportJsonRules();
  const exportCsv = useExportCsvRules();
  const importRules = useImportRules();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);
  const [showQboHelp, setShowQboHelp] = useState(false);

  const onPickFile = () => fileInputRef.current?.click();

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // allow re-selecting same file
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = await importRules.mutateAsync(parsed);
      setFeedback({ kind: 'success', message: `Imported ${result.imported} rule(s).` });
    } catch (err) {
      // Surface server-side per-rule errors when present (the
      // AppError detail payload is on err.message via the
      // apiClient error format).
      const message = err instanceof Error ? err.message : 'Import failed';
      setFeedback({ kind: 'error', message });
    }
  };

  return (
    <div className="flex items-center gap-2 relative">
      <input
        type="file"
        accept="application/json"
        ref={fileInputRef}
        onChange={onFileChosen}
        className="hidden"
        aria-label="Import rules JSON file"
      />
      <Button variant="secondary" onClick={onPickFile} disabled={importRules.isPending}>
        <Upload className="h-3.5 w-3.5 mr-1" />
        {importRules.isPending ? 'Importing…' : 'Import'}
      </Button>
      <Button variant="secondary" onClick={() => exportJson.mutate()} disabled={exportJson.isPending}>
        <Download className="h-3.5 w-3.5 mr-1" />
        Export JSON
      </Button>
      <Button variant="secondary" onClick={() => exportCsv.mutate()} disabled={exportCsv.isPending}>
        <Download className="h-3.5 w-3.5 mr-1" />
        Export CSV
      </Button>
      <button
        type="button"
        onClick={() => setShowQboHelp((s) => !s)}
        className="text-xs text-gray-500 hover:text-gray-700 underline"
      >
        QBO format?
      </button>
      {showQboHelp && (
        <div className="absolute top-full right-0 mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-lg p-3 z-10 text-xs text-gray-700">
          QuickBooks Online rule CSV import isn&apos;t supported yet — the QBO export format isn&apos;t formally documented and a hand-mapped importer would silently drop edge cases. Use JSON export from QBO &rarr; manual conversion &rarr; JSON import here.
        </div>
      )}
      {feedback && (
        <div
          className={`absolute top-full right-0 mt-12 max-w-sm rounded-md border px-3 py-2 text-xs ${
            feedback.kind === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <span>{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-gray-400 hover:text-gray-700"
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
