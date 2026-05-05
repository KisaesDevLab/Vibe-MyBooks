// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Super-admin page for bulk-importing bookkeeping data from
// Accounting Power (CSV) or QuickBooks Online (XLSX). Two-step UX:
//
//   1. Upload — pick file + kind + source-system; server parses and
//      stages the canonical rows in import_sessions, returning a
//      preview + validation errors.
//   2. Commit — operator reviews preview, fixes any errors offline
//      (re-upload), then clicks Commit. Server posts via the
//      existing accounts insert / postTransaction paths.
//
// Recommended workflow when migrating an entity end-to-end:
// CoA → Contacts → Trial Balance → GL Transactions. The server
// enforces dependencies at commit time (refuses GL/TB whose accounts
// aren't in the CoA), so the operator can do the steps in any order
// without bricking themselves.

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Upload, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';
import {
  useUploadImport,
  useImportSession,
  useCommitImport,
  useDeleteImport,
} from '../../api/hooks/useImports';
import type {
  ImportKind,
  ImportUploadOptions,
  SourceSystem,
  TbColumnChoice,
  ContactKind,
} from '@kis-books/shared';

const KIND_OPTIONS: { value: ImportKind; label: string }[] = [
  { value: 'coa', label: 'Chart of Accounts' },
  { value: 'contacts', label: 'Contacts (Customers / Vendors)' },
  { value: 'trial_balance', label: 'Trial Balance (opening JE)' },
  { value: 'gl_transactions', label: 'GL Transactions' },
];

const SOURCE_OPTIONS: { value: SourceSystem; label: string }[] = [
  { value: 'accounting_power', label: 'Accounting Power' },
  { value: 'quickbooks_online', label: 'QuickBooks Online' },
];

export function BulkImportPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId?: string }>();
  if (sessionId) return <SessionView id={sessionId} onClose={() => navigate('/admin/import')} />;
  return <UploadForm onCreated={(id) => navigate(`/admin/import/${id}`)} />;
}

// ── Upload form ───────────────────────────────────────────────────

function UploadForm({ onCreated }: { onCreated: (sessionId: string) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<ImportKind>('coa');
  const [sourceSystem, setSourceSystem] = useState<SourceSystem>('quickbooks_online');
  const [contactKind, setContactKind] = useState<ContactKind>('customer');
  const [tbColumn, setTbColumn] = useState<TbColumnChoice>('beginning');
  const [tbReportDate, setTbReportDate] = useState<string>(defaultPriorYearEnd());
  const [updateExisting, setUpdateExisting] = useState(false);
  const upload = useUploadImport();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const options: ImportUploadOptions = {};
    if (kind === 'coa') options.updateExistingCoa = updateExisting;
    if (kind === 'contacts') options.contactKind = contactKind;
    if (kind === 'trial_balance' && sourceSystem === 'accounting_power') {
      options.tbColumn = tbColumn;
      options.tbReportDate = tbReportDate;
    }
    const result = await upload.mutateAsync({ file, kind, sourceSystem, options });
    onCreated(result.session.id);
  };

  // QBO doesn't ship contacts as separate Customers/Vendors files in
  // every export, but for the canonical case these inputs make sense.
  // AP doesn't ship contacts at all; surface a hint when the operator
  // selects an unsupported combination.
  const isUnsupportedCombo =
    sourceSystem === 'accounting_power' && kind === 'contacts';

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Upload className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Bulk Import</h1>
      </div>
      <p className="text-sm text-gray-600">
        Recommended order: <strong>Chart of Accounts</strong> → <strong>Contacts</strong> →{' '}
        <strong>Trial Balance</strong> → <strong>GL Transactions</strong>. The server enforces
        these dependencies at commit time (e.g. it refuses GL transactions whose accounts
        aren&apos;t in the chart of accounts), so you can do them in any order without making a
        mess.
      </p>

      <form onSubmit={submit} className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-5">
        {/* Source system */}
        <fieldset>
          <legend className="text-sm font-medium text-gray-700 mb-2">Source system</legend>
          <div className="flex gap-4">
            {SOURCE_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={sourceSystem === o.value}
                  onChange={() => setSourceSystem(o.value)}
                />
                <span className="text-sm">{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Kind */}
        <fieldset>
          <legend className="text-sm font-medium text-gray-700 mb-2">What are you importing?</legend>
          <div className="grid grid-cols-2 gap-2">
            {KIND_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-center gap-2 cursor-pointer p-2 border border-gray-200 rounded-md hover:bg-gray-50">
                <input
                  type="radio"
                  checked={kind === o.value}
                  onChange={() => setKind(o.value)}
                />
                <span className="text-sm">{o.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Kind-conditional sub-options */}
        {kind === 'coa' && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={updateExisting}
              onChange={(e) => setUpdateExisting(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">
              Update existing accounts (overwrite name / detail type / description)
            </span>
          </label>
        )}

        {kind === 'contacts' && (
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 mb-2">Contact kind</legend>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={contactKind === 'customer'}
                  onChange={() => setContactKind('customer')}
                />
                <span className="text-sm">Customers</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={contactKind === 'vendor'}
                  onChange={() => setContactKind('vendor')}
                />
                <span className="text-sm">Vendors</span>
              </label>
            </div>
          </fieldset>
        )}

        {kind === 'trial_balance' && sourceSystem === 'accounting_power' && (
          <div className="space-y-3 bg-amber-50 border border-amber-200 rounded-md p-3">
            <p className="text-xs text-amber-800">
              Accounting Power trial-balance exports don&apos;t carry an &ldquo;as of&rdquo; date.
              Choose which signed-balance column to post and supply the JE date.
            </p>
            <fieldset>
              <legend className="text-sm font-medium text-gray-700 mb-2">Balance column</legend>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={tbColumn === 'beginning'}
                    onChange={() => setTbColumn('beginning')}
                  />
                  <span className="text-sm">Beginning Balance</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={tbColumn === 'adjusted'}
                    onChange={() => setTbColumn('adjusted')}
                  />
                  <span className="text-sm">Adjusted Balance</span>
                </label>
              </div>
            </fieldset>
            <label className="block text-sm">
              <span className="text-gray-700 font-medium">Report date</span>
              <input
                type="date"
                value={tbReportDate}
                onChange={(e) => setTbReportDate(e.target.value)}
                className="mt-1 block rounded-md border border-gray-300 px-3 py-2"
                required
              />
            </label>
          </div>
        )}

        {isUnsupportedCombo && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <span>Accounting Power doesn&apos;t export contacts as a separate file. Switch source to QuickBooks Online.</span>
          </div>
        )}

        {/* File picker */}
        <label className="block">
          <span className="text-sm font-medium text-gray-700">File</span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.tsv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-sm"
            required
          />
        </label>

        {upload.error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <span>{(upload.error as Error).message}</span>
          </div>
        )}

        <Button type="submit" loading={upload.isPending} disabled={!file || isUnsupportedCombo}>
          Upload &amp; preview
        </Button>
      </form>
    </div>
  );
}

// ── Session view ──────────────────────────────────────────────────

function SessionView({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading, error, refetch } = useImportSession(id);
  const commit = useCommitImport();
  const remove = useDeleteImport();

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (error) return <div className="p-6 text-red-700">{(error as Error).message}</div>;
  if (!data) return null;

  const { session, preview, validationErrors } = data;
  const isCommitted = session.status === 'committed';
  const canCommit = !isCommitted && validationErrors.length === 0;

  const handleCommit = async () => {
    await commit.mutateAsync({ id });
    refetch();
  };

  const handleDelete = async () => {
    if (!confirm('Delete this import session? No GL changes occur — only the staged session is removed.')) return;
    await remove.mutateAsync(id);
    onClose();
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="h-6 w-6 text-gray-700" />
            {session.originalFilename}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {session.kind} · {session.sourceSystem} ·{' '}
            <span
              className={
                isCommitted
                  ? 'text-green-700'
                  : session.status === 'failed'
                    ? 'text-red-700'
                    : 'text-gray-700'
              }
            >
              {session.status}
            </span>
          </p>
        </div>
        <Button variant="secondary" onClick={onClose}>
          Back
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryStat label="Rows parsed" value={preview.totalRows} />
        <SummaryStat label="Errors" value={preview.errorCount} tone={preview.errorCount > 0 ? 'red' : undefined} />
        {preview.jeGroupCount !== undefined && (
          <SummaryStat label="Journal entries" value={preview.jeGroupCount} />
        )}
        {preview.voidEntryCount !== undefined && preview.voidEntryCount > 0 && (
          <SummaryStat label="Void reversals" value={preview.voidEntryCount} />
        )}
        {preview.totalDebit !== undefined && (
          <SummaryStat label="Total debit" value={preview.totalDebit} />
        )}
        {preview.totalCredit !== undefined && (
          <SummaryStat label="Total credit" value={preview.totalCredit} />
        )}
        {preview.reportDate && (
          <SummaryStat label="Report date" value={preview.reportDate} />
        )}
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h2 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {validationErrors.length} validation error{validationErrors.length === 1 ? '' : 's'}
          </h2>
          <ul className="space-y-1 text-xs text-red-700 max-h-64 overflow-y-auto">
            {validationErrors.slice(0, 100).map((err, i) => (
              <li key={i}>
                <strong>Row {err.rowNumber || '?'}</strong> [{err.code}] {err.message}
              </li>
            ))}
            {validationErrors.length > 100 && (
              <li className="italic">…and {validationErrors.length - 100} more.</li>
            )}
          </ul>
        </div>
      )}

      {/* Sample rows preview */}
      {preview.sampleRows.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <h2 className="text-sm font-semibold text-gray-800 px-4 py-3 border-b">First {preview.sampleRows.length} parsed rows</h2>
          <pre className="text-xs text-gray-700 px-4 py-3 max-h-96 overflow-auto">
            {JSON.stringify(preview.sampleRows.slice(0, 50), null, 2)}
          </pre>
        </div>
      )}

      {/* Commit result */}
      {isCommitted && session.commitResult && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 space-y-1 text-sm text-green-800">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle className="h-4 w-4" /> Committed
          </div>
          <div>Created: {session.commitResult.created ?? 0}</div>
          {session.commitResult.skipped !== undefined && (
            <div>Skipped (already existed): {session.commitResult.skipped}</div>
          )}
          {session.commitResult.voidsReversed ? (
            <div>Void reversals posted: {session.commitResult.voidsReversed}</div>
          ) : null}
        </div>
      )}

      {/* Actions */}
      {!isCommitted && (
        <div className="flex gap-3">
          <Button onClick={handleCommit} loading={commit.isPending} disabled={!canCommit}>
            Commit
          </Button>
          <Button variant="secondary" onClick={handleDelete} loading={remove.isPending}>
            Delete session
          </Button>
        </div>
      )}

      {commit.error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span>{(commit.error as Error).message}</span>
        </div>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'red';
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-xl font-semibold ${tone === 'red' ? 'text-red-700' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
}

function defaultPriorYearEnd(): string {
  const d = new Date();
  return `${d.getFullYear() - 1}-12-31`;
}

export default BulkImportPage;
