// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStatementJobs, useDeleteStatementJob, useReprocessStatementJob, type StatementJobSummary, type StatementJobSortKey, type StatementJobDisposition } from '../../api/hooks/useAi';
import { SortableTh } from '../../components/ui/SortableTh';
import { useColumnView } from '../../hooks/useColumnView';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toaster';
import { Pagination } from '../../components/ui/Pagination';
import { FileText, Upload, Trash2, AlertTriangle, RefreshCw, Eye } from 'lucide-react';
import { openAttachmentInTab } from '../attachments/openAttachmentInTab';

type StatusKey = 'processing' | 'pending' | 'imported' | 'failed';
type Disposition = { key: StatusKey; label: string; cls: string; canResume: boolean; canReprocess: boolean };

// Map a job row to a user-facing status. imported_at wins over the raw job
// status so a re-importable/finished statement reads correctly. MUST stay in
// step with the SQL CASE in listStatementJobs (ai-statement-parser.service),
// which the Status filter and sort run on.
function disposition(job: StatementJobSummary): Disposition {
  if (job.importedAt) return { key: 'imported', label: 'Imported', cls: 'bg-green-100 text-green-700', canResume: true, canReprocess: false };
  if (job.status === 'failed' || job.status === 'cancelled') return { key: 'failed', label: 'Failed', cls: 'bg-red-100 text-red-700', canResume: false, canReprocess: true };
  if (job.status === 'complete') return { key: 'pending', label: 'Pending review', cls: 'bg-amber-100 text-amber-700', canResume: true, canReprocess: true };
  return { key: 'processing', label: 'Processing…', cls: 'bg-gray-100 text-gray-600', canResume: false, canReprocess: false };
}

const STATUS_FILTERS: { value: '' | StatusKey; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'processing', label: 'Processing…' },
  { value: 'pending', label: 'Pending review' },
  { value: 'imported', label: 'Imported' },
  { value: 'failed', label: 'Failed' },
];
const STATUS_OPTIONS = STATUS_FILTERS.filter((f) => f.value).map((f) => ({ value: f.value, label: f.label }));
const SORT_KEYS: readonly StatementJobSortKey[] = ['fileName', 'createdAt', 'transactionCount', 'status'];

// Rows-per-page choices — the jobs endpoint caps limit at 200.
const PAGE_SIZE_OPTIONS = ['25', '50', '100', '200'];
const DEFAULT_PAGE_SIZE = '50';

function fmtDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function StatementImportsPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const justUploaded = Number(params.get('uploaded') || '0');
  // Server-side pagination, sort and status filter — the filter used to be
  // client-side and only narrowed the fetched page. The Status select and
  // the header popover share one entry (one value ↔ the select).
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [offset, setOffset] = useState(0);
  const limit = parseInt(pageSize, 10);
  const view = useColumnView<StatementJobSortKey>('vibe:statement-imports:view', {
    sortKeys: SORT_KEYS, defaultDir: (k) => (k === 'createdAt' ? 'desc' : 'asc'),
  });
  const statusSet = view.filterFor('status');
  const statusFilter = (statusSet.size === 1 ? [...statusSet][0] : '') as '' | StatusKey;
  const setStatusFilter = (v: '' | StatusKey) => view.setFilter('status', new Set(v ? [v] : []));
  useEffect(() => { setOffset(0); }, [view.signature]);
  const { data, isLoading, isError, refetch } = useStatementJobs({
    limit, offset,
    sortBy: view.sortCol || undefined,
    sortDir: view.sortCol ? view.sortDir : undefined,
    status: statusSet.size > 0 ? ([...statusSet] as StatementJobDisposition[]) : undefined,
  });
  const del = useDeleteStatementJob();
  const reprocess = useReprocessStatementJob();
  const toast = useToast();

  const onReprocess = (job: StatementJobSummary) => {
    reprocess.mutate(job.jobId, {
      onSuccess: () => toast.info(`Re-processing ${job.fileName} — extracting in the background.`),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Couldn’t re-process the statement.'),
    });
  };

  const jobs = data?.jobs ?? [];
  const processingCount = jobs.filter((j) => j.status === 'pending' || j.status === 'processing').length;
  // The filter now runs server-side, so the page IS the visible set.
  const visibleJobs = jobs;
  const filtered = statusSet.size > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Statement Processing</h1>
          <p className="text-sm text-gray-500 mt-1">Uploaded bank statements and their extracted transactions. Statements extract in the background — review and import each when it’s ready.</p>
        </div>
        <Button onClick={() => navigate('/banking/statement-upload')}>
          <Upload className="h-4 w-4 mr-1" /> Upload statements
        </Button>
      </div>

      {justUploaded > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-800">
          Uploaded {justUploaded} statement{justUploaded === 1 ? '' : 's'} — extracting in the background.
          {processingCount > 0 ? ` ${processingCount} still processing…` : ' Ready to review.'}
        </div>
      )}

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

      {!isLoading && !isError && jobs.length === 0 && !filtered && (
        <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600">No statements uploaded yet.</p>
          <p className="text-xs text-gray-400 mt-1">Upload one or more bank statements — they’ll appear here so you can review and import them anytime.</p>
          <div className="mt-4">
            <Button onClick={() => navigate('/banking/statement-upload')}><Upload className="h-4 w-4 mr-1" /> Upload statements</Button>
          </div>
        </div>
      )}

      {!isLoading && !isError && (jobs.length > 0 || filtered) && (
        <div className="flex items-center gap-2 mb-3">
          <label htmlFor="statement-status-filter" className="text-sm text-gray-600">Status</label>
          <select
            id="statement-status-filter"
            aria-label="Filter by processing status"
            className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as '' | StatusKey)}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      )}

      {!isLoading && !isError && filtered && visibleJobs.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-600">No statements match this status.</p>
          <button className="text-xs text-blue-600 hover:underline mt-1" onClick={() => view.clearAll()}>Clear filter</button>
        </div>
      )}

      {!isLoading && !isError && visibleJobs.length > 0 && (
        <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 font-medium text-gray-600">
              <tr>
                <SortableTh padding="px-4 py-3" label="Statement" {...view.thProps('fileName')} />
                <SortableTh padding="px-4 py-3" label="Uploaded" {...view.thProps('createdAt')} />
                <SortableTh padding="px-4 py-3" label="Transactions" align="right" {...view.thProps('transactionCount')} />
                <SortableTh padding="px-4 py-3" label="Status" {...view.thProps('status')} filter={view.filterProps('status', STATUS_OPTIONS, { ariaLabel: 'Filter Status' })} />
                <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleJobs.map((job) => {
                const d = disposition(job);
                // Narrowed once here: the guard inside JSX does not reach
                // into the click handler's closure.
                const attachmentId = job.attachmentId;
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
                        {/* The uploaded statement is an ordinary attachment;
                            the job carries its id. Opens in a new tab so the
                            source can be checked against the extraction. */}
                        {attachmentId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Open the uploaded statement PDF in a new tab"
                            onClick={() => { void openAttachmentInTab(attachmentId); }}
                          >
                            <Eye className="h-4 w-4 mr-1" /> View PDF
                          </Button>
                        )}
                        {d.canResume && (
                          <Button size="sm" variant="secondary" onClick={() => navigate(`/banking/statement-upload?resume=${job.jobId}`)}>
                            {job.importedAt ? 'View' : 'Review & import'}
                          </Button>
                        )}
                        {d.canReprocess && (
                          <Button
                            size="sm"
                            variant="secondary"
                            title="Re-process — extract this statement again from the original file"
                            onClick={() => onReprocess(job)}
                            loading={reprocess.isPending && reprocess.variables === job.jobId}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" /> Re-process
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
      {!isLoading && !isError && data && (
        <Pagination
          total={data.total}
          limit={limit}
          offset={offset}
          onChange={setOffset}
          unit="imports"
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageSizeChange={(size) => { setPageSize(size); setOffset(0); }}
        />
      )}
    </div>
  );
}
