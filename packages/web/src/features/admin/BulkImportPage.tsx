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

import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Upload, AlertCircle, CheckCircle, FileText, ArrowLeft } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';
import {
  useUploadImport,
  useImportSession,
  useCommitImport,
  useDeleteImport,
  ImportApiError,
} from '../../api/hooks/useImports';
import type {
  CanonicalCoaRow,
  CanonicalContactRow,
  CanonicalGlEntry,
  CanonicalTrialBalanceRow,
  ContactKind,
  ImportKind,
  ImportSession,
  ImportUploadOptions,
  SourceSystem,
  TbColumnChoice,
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

// ── Friendly error mapping ────────────────────────────────────────

/**
 * Translate an ImportApiError (or any Error) into operator-readable
 * copy. Known error codes get specific guidance; everything else falls
 * back to the API message verbatim.
 */
function describeError(err: unknown): string {
  if (!err) return '';
  if (err instanceof ImportApiError) {
    switch (err.code) {
      case 'IMPORT_UNKNOWN_ACCOUNT': {
        const detailsObj = (err.details ?? {}) as Record<string, unknown>;
        const acctKey = detailsObj['accountKey'];
        const acctList = detailsObj['accounts'];
        const acct =
          typeof acctKey === 'string'
            ? acctKey
            : Array.isArray(acctList)
              ? (acctList as string[]).join(', ')
              : undefined;
        return acct
          ? `Unknown account "${acct}". Add it to the company's Chart of Accounts (or correct the source CSV) and re-upload.`
          : 'A journal line references an account that isn\'t in this company\'s Chart of Accounts. Import the CoA first or fix the source file.';
      }
      case 'IMPORT_JE_UNBALANCED':
        return 'A journal entry doesn\'t balance — total debits ≠ total credits. Open the source file and fix the offending entry, then re-upload.';
      case 'IMPORT_TB_DUPLICATE':
        return 'An opening journal entry for this date is already on the books. Delete or void the existing one first if you want to re-import.';
      case 'IMPORT_SESSION_ACTIVE':
        return 'Another import session for this exact file is already in progress on this company. Open it and either commit or delete it before retrying.';
      case 'IMPORT_HEADER_NOT_FOUND':
        return 'Could not find the expected column headers in the file. Make sure you picked the right Source system and Import kind for this file.';
      case 'IMPORT_INVALID_FORMAT':
        return 'The file content doesn\'t match its extension (e.g., a renamed binary). Export a fresh CSV or XLSX from your source system.';
      case 'IMPORT_BAD_DATE':
        return 'A date couldn\'t be parsed. Accounting Power trial-balance imports require an explicit Report date you supply at upload time.';
      case 'IMPORT_UNKNOWN_TYPE':
        return 'An account Type value wasn\'t recognized. Check the source file\'s Type column.';
      case 'IMPORT_HAS_ERRORS':
        return 'There are validation errors that must be cleared before this session can be committed. Review the errors below and re-upload a corrected file.';
      case 'IMPORT_ROW_LIMIT_EXCEEDED':
        return err.message; // server message includes the cap + count, already operator-friendly
      case 'IMPORT_TB_COLUMN_REQUIRED':
        return 'Pick a Balance column (Beginning or Adjusted) before uploading an Accounting Power trial balance.';
      case 'IMPORT_CONTACT_KIND_REQUIRED':
        return 'Pick a Contact kind (Customers or Vendors) before uploading the file.';
      case 'IMPORT_TERMINAL':
        return 'This session has already been committed, failed, or cancelled. Start a new upload.';
      case 'IMPORT_POST_FAILED':
        return err.message;
      default:
        return err.message;
    }
  }
  return err instanceof Error ? err.message : String(err);
}

// ── Upload form ───────────────────────────────────────────────────

function UploadForm({ onCreated }: { onCreated: (sessionId: string) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<ImportKind>('coa');
  const [sourceSystem, setSourceSystem] = useState<SourceSystem>('accounting_power');
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
    try {
      const result = await upload.mutateAsync({ file, kind, sourceSystem, options });
      onCreated(result.session.id);
    } catch {
      // Clear the file input on rejection so the operator can re-pick a
      // corrected file without first manually clearing the selection.
      // useMutation already populates upload.error for rendering.
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
            ref={fileInputRef}
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
            <span>{describeError(upload.error)}</span>
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
  const [showAllErrors, setShowAllErrors] = useState(false);

  if (isLoading) return <LoadingSpinner className="py-12" />;

  // Recoverable error state — give the operator a way out instead of
  // stranding them on a half-rendered page.
  if (error) {
    const isMissing = error.status === 404;
    return (
      <div className="p-6 max-w-2xl space-y-4">
        <Button variant="secondary" onClick={onClose}>
          <ArrowLeft className="h-4 w-4 mr-1 inline" />
          Back to Bulk Import
        </Button>
        <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span>
            {isMissing
              ? 'This import session no longer exists. It may have been deleted, or the URL is wrong.'
              : describeError(error)}
          </span>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const { session, preview, validationErrors } = data;
  const isCommitted = session.status === 'committed';
  const isFailed = session.status === 'failed';
  const canCommit = !isCommitted && !isFailed && validationErrors.length === 0;

  const handleCommit = async () => {
    try {
      await commit.mutateAsync({ id });
    } catch {
      // surfaced via commit.error
    }
    await refetch();
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
                  : isFailed
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

      {/* Validation errors — capped by default to keep the DOM small for
          files that produced thousands of errors (a 5,000-error file
          rendered all at once was sluggish to scroll). Operator can
          expand to see the full set when they need it. */}
      {validationErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h2 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {validationErrors.length} validation error{validationErrors.length === 1 ? '' : 's'}
          </h2>
          <ul className="space-y-1 text-xs text-red-700 max-h-96 overflow-y-auto pr-2">
            {(showAllErrors ? validationErrors : validationErrors.slice(0, 100)).map((err, i) => (
              <li key={i}>
                <strong>Row {err.rowNumber || '?'}</strong> [{err.code}] {err.message}
              </li>
            ))}
          </ul>
          {validationErrors.length > 100 && (
            <button
              type="button"
              className="mt-2 text-xs underline text-red-800"
              onClick={() => setShowAllErrors((s) => !s)}
            >
              {showAllErrors
                ? `Hide all (showing ${validationErrors.length})`
                : `Show all ${validationErrors.length} errors`}
            </button>
          )}
        </div>
      )}

      {/* Sample rows preview — kind-specific tables */}
      {preview.sampleRows.length > 0 && (
        <PreviewTable kind={session.kind} sampleRows={preview.sampleRows} />
      )}

      {/* Commit result */}
      {isCommitted && session.commitResult && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 space-y-2 text-sm text-green-800">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle className="h-4 w-4" /> Committed
          </div>
          <div className="space-y-1">
            <div>Created: {session.commitResult.created ?? 0}</div>
            {session.commitResult.skipped !== undefined && (
              <div>Skipped (already existed): {session.commitResult.skipped}</div>
            )}
            {session.commitResult.updated !== undefined && session.commitResult.updated > 0 && (
              <div>Updated: {session.commitResult.updated}</div>
            )}
            {session.commitResult.voidsReversed !== undefined && session.commitResult.voidsReversed > 0 && (
              <div>Void reversals posted: {session.commitResult.voidsReversed}</div>
            )}
          </div>
          <SuccessLink session={session} />
        </div>
      )}

      {/* Failed-commit summary — partial progress + error details. Red
          (not amber) because this is a hard failure, not a warning. */}
      {isFailed && session.commitResult && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 space-y-1 text-sm text-red-700">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4" /> Commit failed
          </div>
          {session.commitResult.created !== undefined && session.commitResult.created > 0 && (
            <div>{session.commitResult.created} entries had already posted before the failure.</div>
          )}
          {session.commitResult.failedAtIndex !== undefined && (
            <div>Failed at entry index {session.commitResult.failedAtIndex}.</div>
          )}
          {session.commitResult.error && (
            <div className="font-mono text-xs">{session.commitResult.error}</div>
          )}
        </div>
      )}

      {/* Actions */}
      {!isCommitted && !isFailed && (
        <div className="flex gap-3">
          <Button onClick={handleCommit} loading={commit.isPending} disabled={!canCommit}>
            Commit
          </Button>
          <Button variant="secondary" onClick={handleDelete} loading={remove.isPending}>
            Delete session
          </Button>
        </div>
      )}

      {/* When the session has been moved to 'failed' the failure summary
          block above already explains what happened with persisted detail.
          Showing commit.error here too would render the same message twice
          (once amber-now-red summary, once red toast). Suppress the toast
          when isFailed; otherwise show it for transient errors that didn't
          flip the session into 'failed'. */}
      {commit.error && !isFailed && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <span>{describeError(commit.error)}</span>
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

// ── Per-kind preview tables ───────────────────────────────────────

function PreviewTable({ kind, sampleRows }: { kind: ImportKind; sampleRows: unknown[] }) {
  if (sampleRows.length === 0) return null;
  const tableEl = (() => {
    if (kind === 'coa') return <CoaPreviewTable rows={sampleRows as CanonicalCoaRow[]} />;
    if (kind === 'contacts') return <ContactsPreviewTable rows={sampleRows as CanonicalContactRow[]} />;
    if (kind === 'trial_balance') return <TbPreviewTable rows={sampleRows as CanonicalTrialBalanceRow[]} />;
    if (kind === 'gl_transactions') return <GlPreviewTable entries={sampleRows as CanonicalGlEntry[]} />;
    return null;
  })();
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <h2 className="text-sm font-semibold text-gray-800 px-4 py-3 border-b">
        First {sampleRows.length} parsed rows
      </h2>
      <div className="max-h-96 overflow-auto">{tableEl}</div>
    </div>
  );
}

const TH = 'text-left px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 sticky top-0';
const TD = 'px-3 py-1.5 text-sm text-gray-800 border-t border-gray-100';

function CoaPreviewTable({ rows }: { rows: CanonicalCoaRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead><tr>
        <th className={TH}>Row</th>
        <th className={TH}>Account #</th>
        <th className={TH}>Name</th>
        <th className={TH}>Type</th>
        <th className={TH}>Detail</th>
        <th className={TH}>Parent</th>
      </tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className={TD}>{r.rowNumber}</td>
            <td className={TD}>{r.accountNumber ?? '—'}</td>
            <td className={TD}>{r.name}</td>
            <td className={TD}>{r.accountType}</td>
            <td className={TD}>{r.detailType ?? '—'}</td>
            <td className={TD}>{r.parentNumber ?? r.parentName ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ContactsPreviewTable({ rows }: { rows: CanonicalContactRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead><tr>
        <th className={TH}>Row</th>
        <th className={TH}>Display name</th>
        <th className={TH}>Kind</th>
        <th className={TH}>Email</th>
        <th className={TH}>Phone</th>
      </tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className={TD}>{r.rowNumber}</td>
            <td className={TD}>{r.displayName}</td>
            <td className={TD}>{r.contactType}</td>
            <td className={TD}>{r.email ?? '—'}</td>
            <td className={TD}>{r.phone ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TbPreviewTable({ rows }: { rows: CanonicalTrialBalanceRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead><tr>
        <th className={TH}>Row</th>
        <th className={TH}>Account #</th>
        <th className={TH}>Account name</th>
        <th className={`${TH} text-right`}>Debit</th>
        <th className={`${TH} text-right`}>Credit</th>
      </tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td className={TD}>{r.rowNumber}</td>
            <td className={TD}>{r.accountNumber ?? '—'}</td>
            <td className={TD}>{r.accountName ?? '—'}</td>
            <td className={`${TD} text-right tabular-nums`}>{r.debit ?? ''}</td>
            <td className={`${TD} text-right tabular-nums`}>{r.credit ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GlPreviewTable({ entries }: { entries: CanonicalGlEntry[] }) {
  return (
    <table className="w-full text-sm">
      <thead><tr>
        <th className={TH}>Date</th>
        <th className={TH}>Type</th>
        <th className={TH}>Ref</th>
        <th className={TH}>Account</th>
        <th className={`${TH} text-right`}>Debit</th>
        <th className={`${TH} text-right`}>Credit</th>
        <th className={TH}>Memo</th>
      </tr></thead>
      <tbody>
        {entries.flatMap((e, ei) =>
          e.lines.map((line, li) => (
            // Continuation rows get a slight bg-shade rather than
            // opacity-80 so the cell text keeps full WCAG contrast —
            // opacity drops the text-color contrast below AA on light
            // grey backgrounds. The shading still groups the lines
            // visually under their JE header row.
            <tr key={`${ei}-${li}`} className={li === 0 ? '' : 'bg-gray-50/60'}>
              <td className={TD}>{li === 0 ? e.date : ''}</td>
              <td className={TD}>
                {li === 0 ? `${e.sourceCode}${e.isVoidReversal ? ' (void)' : ''}` : ''}
              </td>
              <td className={TD}>{li === 0 ? (e.reference ?? '') : ''}</td>
              <td className={TD}>{line.accountNumber ?? line.accountName ?? '—'}</td>
              <td className={`${TD} text-right tabular-nums`}>{line.debit !== '0' ? line.debit : ''}</td>
              <td className={`${TD} text-right tabular-nums`}>{line.credit !== '0' ? line.credit : ''}</td>
              <td className={TD}>{li === 0 ? (e.memo ?? '') : ''}</td>
            </tr>
          )),
        )}
      </tbody>
    </table>
  );
}

// ── Success link ──────────────────────────────────────────────────

function SuccessLink({ session }: { session: ImportSession }) {
  let target: string | null = null;
  let label = '';
  if (session.kind === 'coa') {
    target = '/accounts';
    label = 'View Chart of Accounts';
  } else if (session.kind === 'contacts') {
    target = '/contacts';
    label = 'View Contacts';
  } else if (session.kind === 'trial_balance') {
    target = '/transactions?source=trial_balance_import';
    label = 'View opening journal entry';
  } else if (session.kind === 'gl_transactions') {
    const sourceTag =
      session.sourceSystem === 'accounting_power' ? 'accounting_power_import' : 'quickbooks_online_import';
    target = `/transactions?source=${sourceTag}`;
    label = 'View imported transactions';
  }
  if (!target) return null;
  return (
    <div className="pt-2">
      <Link to={target} className="inline-flex items-center text-sm font-medium text-green-800 underline">
        {label} →
      </Link>
    </div>
  );
}

function defaultPriorYearEnd(): string {
  const d = new Date();
  return `${d.getFullYear() - 1}-12-31`;
}

export default BulkImportPage;
