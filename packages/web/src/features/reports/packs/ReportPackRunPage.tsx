// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Report Pack run status — polls one async render and surfaces its progress.
//
// While queued/running: a progress bar with "Rendering i/N: <report label>".
// On succeeded/partial: Download PDF (transient, generated on demand) plus a
// Regenerate action; partial also lists the report(s) that failed. On failed:
// the error message + Regenerate.

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { getReportDef } from '@kis-books/shared';
import {
  useReportPackRun,
  useCreatePackRun,
  downloadPackPdf,
} from '../../../api/hooks/useReportPacks';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../../components/ui/ErrorMessage';
import { useToast } from '../../../components/ui/Toaster';

function reportLabel(reportId: string | null | undefined): string {
  if (!reportId) return '';
  return getReportDef(reportId)?.label ?? reportId;
}

export function ReportPackRunPage() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const runQuery = useReportPackRun(runId);
  const createRun = useCreatePackRun();
  const [downloading, setDownloading] = useState(false);

  if (runQuery.isLoading) {
    return <LoadingSpinner className="py-16" />;
  }
  if (runQuery.isError || !runQuery.data) {
    return <ErrorMessage message="Could not load this report pack run." onRetry={runQuery.refetch} />;
  }

  const run = runQuery.data;
  const isTerminal = run.status === 'succeeded' || run.status === 'partial' || run.status === 'failed';
  const failures = run.errorJson?.failures ?? [];

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadPackPdf(run.id, `report-pack-${run.id}.pdf`);
    } catch (err) {
      toast.error('Download failed', { detail: (err as Error).message });
    }
    setDownloading(false);
  };

  const handleRegenerate = async () => {
    try {
      const next = await createRun.mutateAsync({ packId: run.packId });
      navigate(`/reports/packs/runs/${next.id}`);
    } catch (err) {
      toast.error('Could not regenerate', { detail: (err as Error).message });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Report Pack</h1>
        <Button variant="ghost" onClick={() => navigate('/reports/packs')}>
          Back to packs
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        {!isTerminal && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <LoadingSpinner size="sm" />
              <span className="text-sm font-medium text-gray-700">
                {run.status === 'queued'
                  ? 'Queued — waiting to start…'
                  : run.currentReportId
                    ? `Rendering: ${reportLabel(run.currentReportId)}`
                    : 'Rendering…'}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, Math.max(0, run.progress))}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">{run.progress}% complete</p>
          </div>
        )}

        {(run.status === 'succeeded' || run.status === 'partial') && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              {run.status === 'succeeded' ? (
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              )}
              <span className="text-lg font-semibold text-gray-900">
                {run.status === 'succeeded' ? 'Ready to download' : 'Ready — with some skipped reports'}
              </span>
            </div>
            {run.pageCount != null && (
              <p className="text-sm text-gray-500 mb-4">{run.pageCount} page(s)</p>
            )}
            <div className="flex gap-2 mb-4">
              <Button onClick={handleDownload} loading={downloading}>
                <Download className="h-4 w-4 mr-1" /> Download PDF
              </Button>
              <Button variant="secondary" onClick={handleRegenerate} loading={createRun.isPending}>
                <RefreshCw className="h-4 w-4 mr-1" /> Regenerate
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              This file is generated on demand and not stored — download it now.
            </p>
            {run.status === 'partial' && failures.length > 0 && (
              <div className="mt-5 border-t border-gray-100 pt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Skipped reports</p>
                <ul className="space-y-1">
                  {failures.map((f) => (
                    <li key={f.reportId} className="text-sm text-gray-600">
                      <span className="font-medium">{reportLabel(f.reportId)}</span>
                      {f.message ? ` — ${f.message}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {run.status === 'failed' && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <XCircle className="h-6 w-6 text-red-500" />
              <span className="text-lg font-semibold text-gray-900">Generation failed</span>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {run.errorJson?.message || 'The report pack could not be generated.'}
            </p>
            {failures.length > 0 && (
              <ul className="space-y-1 mb-4">
                {failures.map((f) => (
                  <li key={f.reportId} className="text-sm text-gray-600">
                    <span className="font-medium">{reportLabel(f.reportId)}</span>
                    {f.message ? ` — ${f.message}` : ''}
                  </li>
                ))}
              </ul>
            )}
            <Button variant="secondary" onClick={handleRegenerate} loading={createRun.isPending}>
              <RefreshCw className="h-4 w-4 mr-1" /> Regenerate
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
