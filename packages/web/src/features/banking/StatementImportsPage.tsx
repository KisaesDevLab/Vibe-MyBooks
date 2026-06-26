// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useNavigate } from 'react-router-dom';
import { useStatementJobs, useDeleteStatementJob, type StatementJobSummary } from '../../api/hooks/useAi';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { FileText, Upload, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';

type Disposition = { label: string; cls: string; canResume: boolean };

// Map a job row to a user-facing status. imported_at wins over the raw job
// status so a re-importable/finished statement reads correctly.
function disposition(job: StatementJobSummary): Disposition {
  if (job.importedAt) return { label: 'Imported', cls: 'bg-green-100 text-green-700', canResume: true };
  if (job.status === 'failed' || job.status === 'cancelled') return { label: 'Failed', cls: 'bg-red-100 text-red-700', canResume: false };
  if (job.status === 'complete') return { label: 'Pending review', cls: 'bg-amber-100 text-amber-700', canResume: true };
  return { label: 'Processing…', cls: 'bg-gray-100 text-gray-600', canResume: false };
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function StatementImportsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useStatementJobs();
  const del = useDeleteStatementJob();

  const jobs = data?.jobs ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Statement Imports</h1>
          <p className="text-sm text-gray-500 mt-1">Uploaded bank statements and their extracted transactions. Resume a pending statement to review and import it.</p>
        </div>
        <Button onClick={() => navigate('/banking/statement-upload')}>
          <Upload className="h-4 w-4 mr-1" /> Upload statements
        </Button>
      </div>

      {isLoading && (
        <div className="bg-white rounded-lg border p-12 flex justify-center"><LoadingSpinner /></div>
      )}

      {isError && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="h-6 w-6 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-700 mb-3">Couldn’t load statement imports.</p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-1" /> Retry</Button>
        </div>
      )}

      {!isLoading && !isError && jobs.length === 0 && (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No statements uploaded yet.</p>
          <p className="text-xs text-gray-400 mt-1">Upload one or more bank statements — they’ll appear here so you can review and import them anytime.</p>
          <div className="mt-4">
            <Button onClick={() => navigate('/banking/statement-upload')}><Upload className="h-4 w-4 mr-1" /> Upload statements</Button>
          </div>
        </div>
      )}

      {!isLoading && !isError && jobs.length > 0 && (
        <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Statement</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Uploaded</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Transactions</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((job) => {
                const d = disposition(job);
                return (
                  <tr key={job.jobId} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-900">
                      <span className="inline-flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        {job.fileName}
                      </span>
                      {job.error && <div className="text-xs text-red-500 mt-0.5">{job.error}</div>}
                    </td>
                    <td className="px-4 py-2 text-gray-500">{fmtDate(job.createdAt)}</td>
                    <td className="px-4 py-2 text-right text-gray-700">{job.transactionCount || '—'}</td>
                    <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-full ${d.cls}`}>{d.label}</span></td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {d.canResume && (
                          <Button size="sm" variant="secondary" onClick={() => navigate(`/banking/statement-upload?resume=${job.jobId}`)}>
                            {job.importedAt ? 'View' : 'Review & import'}
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => del.mutate(job.jobId)} loading={del.isPending && del.variables === job.jobId}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
