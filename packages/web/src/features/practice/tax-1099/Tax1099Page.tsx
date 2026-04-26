// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Download, FileSearch, Mail, Pencil, FileText, ShieldCheck, Upload } from 'lucide-react';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 14 + 15 — bookkeeper UI.
// Replaces the prior Tax1099Placeholder. Drives the full lifecycle:
// vendor profile editing (TIN, eligibility, backup withholding),
// W-9 request emails, download of completed W-9 PDFs, threshold
// monitoring, and end-of-year filing exports.

interface Summary {
  eligibleVendorCount: number;
  ytdPaymentTotal: number;
  vendorsOverThreshold: number;
  w9sMissing: number;
  w9sExpiring: number;
  excludedCount: number;
}

type VendorStatus = 'compliant' | 'warning' | 'blocked' | 'excluded';

interface VendorRow {
  contactId: string;
  displayName: string;
  is1099Eligible: boolean;
  ytdTotal: number;
  w9OnFile: boolean;
  status: VendorStatus;
  taxId: string | null;
  tinMatchStatus: string | null;
  tinMatchCode: string | null;
  tinMatchDate: string | null;
  exclusionReason: string | null;
  exclusionNote: string | null;
  excludedAt: string | null;
}

const EXCLUSION_REASON_LABELS: Record<string, string> = {
  corporation: 'Corporation (per W-9)',
  foreign: 'Foreign vendor',
  reimbursement_only: 'Reimbursement only',
  tax_exempt: 'Tax-exempt entity',
  employee: 'Should be on W-2',
  other: 'Other',
};

const EXCLUSION_REASON_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'corporation', label: EXCLUSION_REASON_LABELS['corporation']! },
  { value: 'foreign', label: EXCLUSION_REASON_LABELS['foreign']! },
  { value: 'reimbursement_only', label: EXCLUSION_REASON_LABELS['reimbursement_only']! },
  { value: 'tax_exempt', label: EXCLUSION_REASON_LABELS['tax_exempt']! },
  { value: 'employee', label: EXCLUSION_REASON_LABELS['employee']! },
  { value: 'other', label: EXCLUSION_REASON_LABELS['other']! },
];

interface AddressBlock {
  line1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

interface VendorProfile {
  contactId: string;
  is1099Eligible: boolean;
  w9OnFile: boolean;
  w9CapturedAt: string | null;
  w9ExpiresAt: string | null;
  tinMasked: string | null;
  tinType: string | null;
  backupWithholding: boolean;
  notes: string | null;
  mailingAddress: AddressBlock;
  contactBillingAddress: AddressBlock;
  exclusionReason: string | null;
  exclusionNote: string | null;
  excludedAt: string | null;
}

interface Filing {
  id: string;
  taxYear: number;
  formType: string;
  exportFormat: string;
  vendorCount: number;
  totalAmount: string;
  exportedAt: string;
  correctionOf: string | null;
}

interface FilingDetailRow {
  contactId: string;
  displayName: string;
  amount: number;
  tinMasked: string | null;
  tinType: string | null;
  backupWithholding: boolean;
}

interface W9Request {
  id: string;
  status: string;
  requestedContactEmail: string | null;
  requestedContactPhone: string | null;
  sentAt: string;
  viewedAt: string | null;
  completedAt: string | null;
  expiresAt: string;
}

type StatusFilter = 'all' | 'blocked' | 'warning' | 'compliant' | 'no_w9' | 'excluded';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
    },
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error?.message) message = body.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json();
}

export function Tax1099Page() {
  const [taxYear, setTaxYear] = useState<number>(new Date().getUTCFullYear());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [vendors, setVendors] = useState<VendorRow[] | null>(null);
  const [filings, setFilings] = useState<Filing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const [requestVendor, setRequestVendor] = useState<VendorRow | null>(null);
  const [editVendor, setEditVendor] = useState<VendorRow | null>(null);
  const [correctingFiling, setCorrectingFiling] = useState<Filing | null>(null);

  const reload = useCallback(async () => {
    setSummary(null);
    setVendors(null);
    setError(null);
    try {
      const [s, v, f] = await Promise.all([
        api<Summary>(`/practice/1099/summary?taxYear=${taxYear}`),
        api<{ vendors: VendorRow[] }>(`/practice/1099/vendors?taxYear=${taxYear}`),
        api<{ filings: Filing[] }>(`/practice/1099/filings`),
      ]);
      setSummary(s);
      setVendors(v.vendors);
      setFilings(f.filings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load 1099 data.');
    }
  }, [taxYear]);

  useEffect(() => {
    reload();
  }, [reload]);

  const exportCsv = async () => {
    setExporting(true);
    setError(null);
    try {
      const result = await api<{ csv: string; vendorCount: number; totalAmount: number; filingId: string }>(
        '/practice/1099/export',
        {
          method: 'POST',
          body: JSON.stringify({ taxYear, formType: '1099-NEC' }),
        },
      );
      const blob = new Blob([result.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `1099-NEC-${taxYear}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      // Refresh filings list so the new entry appears.
      const f = await api<{ filings: Filing[] }>(`/practice/1099/filings`);
      setFilings(f.filings);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed. Owner role required.');
    } finally {
      setExporting(false);
    }
  };

  const downloadW9 = async (vendor: VendorRow) => {
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/v1/practice/1099/vendors/${vendor.contactId}/w9`, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || 'No W-9 on file');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch W-9.');
    }
  };

  const [tinExporting, setTinExporting] = useState(false);
  const [tinImporting, setTinImporting] = useState(false);
  const [tinMessage, setTinMessage] = useState<string | null>(null);
  const tinFileRef = useRef<HTMLInputElement | null>(null);

  const exportTinMatch = async () => {
    setTinExporting(true);
    setTinMessage(null);
    setError(null);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/v1/practice/1099/tin-match/export', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      const recordCount = res.headers.get('X-Vibe-Record-Count') ?? '0';
      const skippedHeader = res.headers.get('X-Vibe-Skipped');
      let skippedNote = '';
      if (skippedHeader) {
        try {
          const decoded = JSON.parse(atob(skippedHeader)) as Array<{
            displayName: string;
            reason: string;
          }>;
          if (decoded.length > 0) {
            const sample = decoded
              .slice(0, 3)
              .map((s) => `${s.displayName} (${s.reason})`)
              .join('; ');
            skippedNote = ` Skipped ${decoded.length} vendor${decoded.length === 1 ? '' : 's'}: ${sample}${
              decoded.length > 3 ? '…' : ''
            }`;
          }
        } catch {
          /* ignore */
        }
      }
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bulk-tin-match-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      setTinMessage(`Bulk TIN file ready (${recordCount} records).${skippedNote}`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'TIN match export failed.');
    } finally {
      setTinExporting(false);
    }
  };

  const importTinMatch = async (file: File) => {
    setTinImporting(true);
    setTinMessage(null);
    setError(null);
    try {
      const content = await file.text();
      const result = await api<{
        matched: number;
        mismatched: number;
        errors: number;
        unknownAccount: number;
        malformedLineNumbers: number[];
      }>('/practice/1099/tin-match/import', {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
      const issues: string[] = [];
      if (result.unknownAccount > 0)
        issues.push(`${result.unknownAccount} unmatched account number(s)`);
      if (result.malformedLineNumbers.length > 0)
        issues.push(`${result.malformedLineNumbers.length} malformed line(s)`);
      setTinMessage(
        `Imported: ${result.matched} matched, ${result.mismatched} mismatched, ${result.errors} error(s).${
          issues.length ? ' ' + issues.join('; ') + '.' : ''
        }`,
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'TIN match import failed.');
    } finally {
      setTinImporting(false);
      if (tinFileRef.current) tinFileRef.current.value = '';
    }
  };

  const filteredVendors = useMemo(() => {
    if (!vendors) return null;
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      const baseShow = v.is1099Eligible || v.ytdTotal > 0;
      if (!baseShow) return false;
      if (q && !v.displayName.toLowerCase().includes(q)) return false;
      // Hide excluded vendors from the default view — they're already
      // triaged and would otherwise clutter the active-work table.
      // Operator can still surface them via the Excluded filter.
      if (statusFilter === 'all') return v.status !== 'excluded';
      if (statusFilter === 'no_w9') {
        return !v.w9OnFile && v.is1099Eligible && !v.exclusionReason;
      }
      return v.status === statusFilter;
    });
  }, [vendors, search, statusFilter]);

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">1099 Center</h1>
          <p className="text-sm text-gray-600 mt-1">
            Track vendor 1099 eligibility, W-9 status, and YTD payments. Request W-9s, download
            completed forms, and export filing CSVs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={taxYear}
            onChange={(e) => setTaxYear(parseInt(e.target.value, 10))}
            className="text-sm border border-gray-300 rounded-md px-3 py-2"
            aria-label="Tax year"
          >
            {[0, 1, 2, 3, 4].map((delta) => {
              const y = new Date().getUTCFullYear() - delta;
              return (
                <option key={y} value={y}>
                  Tax year {y}
                </option>
              );
            })}
          </select>
          <button
            onClick={exportCsv}
            disabled={exporting || !summary}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting…' : 'Export 1099-NEC'}
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-3 p-3 border border-red-200 bg-red-50 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {!summary ? (
        <div className="py-12 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
            <Tile label="Eligible vendors" value={String(summary.eligibleVendorCount)} />
            <Tile label="YTD payments" value={`$${summary.ytdPaymentTotal.toFixed(2)}`} />
            <Tile label="Over threshold" value={String(summary.vendorsOverThreshold)} />
            <Tile
              label="W-9 missing"
              value={String(summary.w9sMissing)}
              highlight={summary.w9sMissing > 0}
            />
            <Tile label="W-9 expiring" value={String(summary.w9sExpiring)} />
            <Tile label="Excluded" value={String(summary.excludedCount)} />
          </div>

          {summary.w9sMissing > 0 && (
            <div className="mb-4 p-3 border border-amber-200 bg-amber-50 rounded-md text-sm text-amber-900">
              {summary.w9sMissing} 1099-eligible vendor{summary.w9sMissing === 1 ? '' : 's'} missing
              a W-9. Use <strong>Request W-9</strong> on each row below to send a secure collection
              link.
            </div>
          )}
        </>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vendors…"
          className="flex-1 min-w-[200px] text-sm border border-gray-300 rounded-md px-3 py-2"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="text-sm border border-gray-300 rounded-md px-3 py-2"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="blocked">Blocked</option>
          <option value="warning">Warning</option>
          <option value="compliant">Compliant</option>
          <option value="no_w9">Missing W-9</option>
          <option value="excluded">Not 1099-subject</option>
        </select>
      </div>

      {!filteredVendors ? null : filteredVendors.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-300 rounded-lg">
          <FileSearch className="mx-auto h-10 w-10 text-gray-400 mb-3" />
          <h3 className="text-base font-medium text-gray-900 mb-1">No vendors match</h3>
          <p className="text-sm text-gray-500">
            {vendors && vendors.length === 0
              ? 'Mark a contact as 1099-eligible to track them here.'
              : 'Try clearing your search or status filter.'}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Vendor</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">1099-eligible</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700">YTD total</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">W-9</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">TIN match</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Status</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredVendors.map((v) => (
                <tr key={v.contactId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{v.displayName}</td>
                  <td className="px-4 py-3 text-gray-700">{v.is1099Eligible ? 'Yes' : '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-900">
                    ${v.ytdTotal.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{v.w9OnFile ? 'On file' : 'Missing'}</td>
                  <td className="px-4 py-3">
                    <TinMatchPill
                      status={v.tinMatchStatus}
                      code={v.tinMatchCode}
                      date={v.tinMatchDate}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={v.status} exclusionReason={v.exclusionReason} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <RowAction
                        label="Edit"
                        icon={<Pencil className="h-4 w-4" />}
                        onClick={() => setEditVendor(v)}
                      />
                      <RowAction
                        label="Request W-9"
                        icon={<Mail className="h-4 w-4" />}
                        onClick={() => setRequestVendor(v)}
                      />
                      {v.w9OnFile && (
                        <RowAction
                          label="View W-9"
                          icon={<FileText className="h-4 w-4" />}
                          onClick={() => downloadW9(v)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 border border-gray-200 rounded-lg p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              IRS Bulk TIN Matching
            </h2>
            <p className="text-sm text-gray-600 mt-1 max-w-2xl">
              Verify each vendor&rsquo;s TIN/Name pair against IRS records before filing 1099s.
              Download the file below, sign in to{' '}
              <a
                href="https://www.irs.gov/tax-professionals/taxpayer-identification-number-tin-matching"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-700 underline"
              >
                IRS e-Services
              </a>{' '}
              and upload it via Bulk TIN Matching, then import the result file IRS returns
              (~24h later).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportTinMatch}
              disabled={tinExporting}
              className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-800 text-sm font-medium px-4 py-2 rounded-md border border-gray-300"
            >
              <Download className="h-4 w-4" />
              {tinExporting ? 'Preparing…' : 'Download TIN file'}
            </button>
            <input
              ref={tinFileRef}
              type="file"
              accept=".txt,text/plain"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importTinMatch(f);
              }}
            />
            <button
              onClick={() => tinFileRef.current?.click()}
              disabled={tinImporting}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md"
            >
              <Upload className="h-4 w-4" />
              {tinImporting ? 'Importing…' : 'Import results'}
            </button>
          </div>
        </div>
        {tinMessage && (
          <div className="mt-3 p-2 border border-indigo-200 bg-indigo-50 rounded text-sm text-indigo-900">
            {tinMessage}
          </div>
        )}
      </div>

      <AccountMappingPanel />

      <FilingsHistory filings={filings} onCorrect={setCorrectingFiling} />

      {correctingFiling && (
        <CorrectionModal
          filing={correctingFiling}
          onClose={() => setCorrectingFiling(null)}
          onFiled={async () => {
            setCorrectingFiling(null);
            await reload();
          }}
        />
      )}

      {requestVendor && (
        <RequestW9Modal
          vendor={requestVendor}
          onClose={() => setRequestVendor(null)}
          onSubmitted={async () => {
            setRequestVendor(null);
            await reload();
          }}
        />
      )}
      {editVendor && (
        <EditProfileDrawer
          vendor={editVendor}
          onClose={() => setEditVendor(null)}
          onSaved={async () => {
            setEditVendor(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function Tile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        highlight ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'
      }`}
    >
      <p className="text-xs text-gray-500 uppercase">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function TinMatchPill({
  status,
  code,
  date,
}: {
  status: string | null;
  code: string | null;
  date: string | null;
}) {
  if (!status) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  const styles: Record<string, string> = {
    matched: 'bg-green-50 text-green-800 ring-green-600/20',
    mismatched: 'bg-red-50 text-red-800 ring-red-600/20',
    pending: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    error: 'bg-gray-50 text-gray-800 ring-gray-600/20',
  };
  const label =
    status === 'pending'
      ? 'Pending'
      : status === 'matched'
        ? 'Matched'
        : status === 'mismatched'
          ? 'Mismatch'
          : 'Error';
  const title = [
    code ? `Code ${code}` : null,
    date ? `Last checked ${new Date(date).toLocaleDateString()}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <span
      title={title || undefined}
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset ${
        styles[status] ?? styles['error']
      }`}
    >
      {label}
    </span>
  );
}

function StatusPill({
  status,
  exclusionReason,
}: {
  status: VendorStatus;
  exclusionReason?: string | null;
}) {
  const styles: Record<VendorStatus, string> = {
    compliant: 'bg-green-50 text-green-800 ring-green-600/20',
    warning: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    blocked: 'bg-red-50 text-red-800 ring-red-600/20',
    excluded: 'bg-gray-100 text-gray-700 ring-gray-500/20',
  };
  const label = status === 'excluded' ? 'Not 1099-subject' : status;
  const title =
    status === 'excluded' && exclusionReason
      ? EXCLUSION_REASON_LABELS[exclusionReason] ?? exclusionReason
      : undefined;
  return (
    <span
      title={title}
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset ${styles[status]}`}
    >
      {label}
    </span>
  );
}

function RowAction({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function FilingsHistory({
  filings,
  onCorrect,
}: {
  filings: Filing[] | null;
  onCorrect: (f: Filing) => void;
}) {
  if (!filings || filings.length === 0) return null;
  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-2">Filing history</h2>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2 font-medium text-gray-700">Tax year</th>
              <th className="text-left px-4 py-2 font-medium text-gray-700">Form</th>
              <th className="text-left px-4 py-2 font-medium text-gray-700">Type</th>
              <th className="text-right px-4 py-2 font-medium text-gray-700">Vendors</th>
              <th className="text-right px-4 py-2 font-medium text-gray-700">Total</th>
              <th className="text-left px-4 py-2 font-medium text-gray-700">Exported</th>
              <th className="text-right px-4 py-2 font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filings.map((f) => (
              <tr key={f.id}>
                <td className="px-4 py-2 text-gray-900">{f.taxYear}</td>
                <td className="px-4 py-2 text-gray-700">{f.formType}</td>
                <td className="px-4 py-2 text-gray-700">
                  {f.correctionOf ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset bg-amber-50 text-amber-800 ring-amber-600/20">
                      Correction
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset bg-gray-50 text-gray-700 ring-gray-600/20">
                      Original
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right text-gray-900">{f.vendorCount}</td>
                <td className="px-4 py-2 text-right text-gray-900">
                  ${Number(f.totalAmount).toFixed(2)}
                </td>
                <td className="px-4 py-2 text-gray-700">
                  {new Date(f.exportedAt).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right">
                  {!f.correctionOf && (
                    <button
                      type="button"
                      onClick={() => onCorrect(f)}
                      className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                    >
                      Create correction
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RequestW9Modal({
  vendor,
  onClose,
  onSubmitted,
}: {
  vendor: VendorRow;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<'email' | 'sms' | 'both'>('email');
  const [history, setHistory] = useState<W9Request[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ requests: W9Request[] }>(`/practice/1099/vendors/${vendor.contactId}/w9-requests`)
      .then((r) => {
        if (!cancelled) setHistory(r.requests);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [vendor.contactId]);

  const sendEmail = channel === 'email' || channel === 'both';
  const sendSms = channel === 'sms' || channel === 'both';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSuccess(null);
    if (sendEmail && !email.trim()) {
      setErr('Recipient email is required for email delivery.');
      return;
    }
    if (sendSms && !phone.trim()) {
      setErr('Recipient phone number is required for SMS delivery.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api<{ requestId: string; channels: Array<'email' | 'sms'> }>(
        '/practice/1099/w9-requests',
        {
          method: 'POST',
          body: JSON.stringify({
            contactId: vendor.contactId,
            email: sendEmail ? email.trim() : undefined,
            phone: sendSms ? phone.trim() : undefined,
            message: message.trim() || undefined,
          }),
        },
      );
      const channelLabel =
        result.channels.length === 0
          ? 'no channel'
          : result.channels.map((c) => (c === 'sms' ? 'SMS' : 'email')).join(' + ');
      setSuccess(`Sent via ${channelLabel}.`);
      // brief pause so the operator sees the confirmation, then close.
      setTimeout(() => {
        onSubmitted();
      }, 600);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to send request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Request W-9 — ${vendor.displayName}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <fieldset>
          <legend className="text-sm text-gray-700 font-medium mb-1">Delivery channel</legend>
          <div className="flex items-center gap-4 text-sm">
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="channel"
                value="email"
                checked={channel === 'email'}
                onChange={() => setChannel('email')}
              />
              Email
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="channel"
                value="sms"
                checked={channel === 'sms'}
                onChange={() => setChannel('sms')}
              />
              SMS
            </label>
            <label className="inline-flex items-center gap-1">
              <input
                type="radio"
                name="channel"
                value="both"
                checked={channel === 'both'}
                onChange={() => setChannel('both')}
              />
              Both
            </label>
          </div>
        </fieldset>

        {sendEmail && (
          <label className="block text-sm">
            <span className="text-gray-700 font-medium">Recipient email *</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              maxLength={320}
            />
          </label>
        )}

        {sendSms && (
          <label className="block text-sm">
            <span className="text-gray-700 font-medium">Recipient phone *</span>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              autoComplete="tel"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              maxLength={30}
            />
            <span className="text-xs text-gray-500">
              SMS body is just the secure link (carriers split longer messages). Use email if you
              want to include a personal note.
            </span>
          </label>
        )}

        {sendEmail && (
          <label className="block text-sm">
            <span className="text-gray-700 font-medium">Personal message (email only)</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={2000}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        )}

        {err && (
          <div className="p-2 border border-red-200 bg-red-50 rounded text-sm text-red-700">
            {err}
          </div>
        )}
        {success && (
          <div className="p-2 border border-green-200 bg-green-50 rounded text-sm text-green-800">
            {success}
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-60"
          >
            {submitting ? 'Sending…' : 'Send W-9 request'}
          </button>
        </div>
      </form>

      {history && history.length > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-100">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Recent requests</h3>
          <ul className="space-y-1 text-xs text-gray-600">
            {history.slice(0, 5).map((r) => (
              <li key={r.id} className="flex items-center justify-between">
                <span>
                  {[r.requestedContactEmail, r.requestedContactPhone].filter(Boolean).join(' / ') ||
                    '(no destination)'}{' '}
                  — <span className="font-medium uppercase">{r.status}</span>
                </span>
                <span>{new Date(r.sentAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

function EditProfileDrawer({
  vendor,
  onClose,
  onSaved,
}: {
  vendor: VendorRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [is1099Eligible, setIs1099Eligible] = useState<boolean>(vendor.is1099Eligible);
  const [tin, setTin] = useState('');
  const [tinType, setTinType] = useState<'SSN' | 'EIN'>('SSN');
  const [backupWithholding, setBackupWithholding] = useState(false);
  const [notes, setNotes] = useState('');
  const [addrLine1, setAddrLine1] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrZip, setAddrZip] = useState('');
  const [excluded, setExcluded] = useState<boolean>(!!vendor.exclusionReason);
  const [exclusionReason, setExclusionReason] = useState<string>(
    vendor.exclusionReason ?? 'corporation',
  );
  const [exclusionNote, setExclusionNote] = useState<string>(vendor.exclusionNote ?? '');
  // Snapshot of the saved exclusion state so submit() can decide
  // whether to POST (set/update) or DELETE (clear).
  const [savedExclusion, setSavedExclusion] = useState<{
    reason: string | null;
    note: string | null;
  }>({ reason: vendor.exclusionReason, note: vendor.exclusionNote });
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ profile: VendorProfile }>(`/practice/1099/vendors/${vendor.contactId}/profile`)
      .then((r) => {
        if (cancelled) return;
        setProfile(r.profile);
        setIs1099Eligible(r.profile.is1099Eligible);
        setBackupWithholding(r.profile.backupWithholding);
        setNotes(r.profile.notes ?? '');
        if (r.profile.tinType === 'SSN' || r.profile.tinType === 'EIN') {
          setTinType(r.profile.tinType);
        }
        setAddrLine1(r.profile.mailingAddress.line1 ?? '');
        setAddrCity(r.profile.mailingAddress.city ?? '');
        setAddrState(r.profile.mailingAddress.state ?? '');
        setAddrZip(r.profile.mailingAddress.zip ?? '');
        setExcluded(!!r.profile.exclusionReason);
        if (r.profile.exclusionReason) {
          setExclusionReason(r.profile.exclusionReason);
        }
        setExclusionNote(r.profile.exclusionNote ?? '');
        setSavedExclusion({
          reason: r.profile.exclusionReason,
          note: r.profile.exclusionNote,
        });
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load profile');
      });
    return () => {
      cancelled = true;
    };
  }, [vendor.contactId]);

  const copyFromContactBilling = () => {
    if (!profile) return;
    setAddrLine1(profile.contactBillingAddress.line1 ?? '');
    setAddrCity(profile.contactBillingAddress.city ?? '');
    setAddrState(profile.contactBillingAddress.state ?? '');
    setAddrZip(profile.contactBillingAddress.zip ?? '');
    setInfo('Copied from contact billing address. Save to persist.');
  };

  const applyToContact = async () => {
    setErr(null);
    setInfo(null);
    setApplying(true);
    try {
      await api(`/practice/1099/vendors/${vendor.contactId}/apply-w9-address`, {
        method: 'POST',
      });
      setInfo('1099 mailing address applied to contact billing address.');
      // Refresh the profile so the "differs from billing" hint updates.
      const r = await api<{ profile: VendorProfile }>(
        `/practice/1099/vendors/${vendor.contactId}/profile`,
      );
      setProfile(r.profile);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to apply address.');
    } finally {
      setApplying(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setInfo(null);

    // Validate exclusion *before* the PUT so we don't half-save on
    // a missing required note.
    if (excluded && exclusionReason === 'other' && !exclusionNote.trim()) {
      setErr('A note is required when the exclusion reason is "Other".');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        is1099Eligible,
        backupWithholding,
        notes: notes.trim() || null,
      };
      const tinDigits = tin.replace(/[-\s]/g, '');
      if (tinDigits) {
        if (!/^\d{9}$/.test(tinDigits)) {
          throw new Error('TIN must be exactly 9 digits.');
        }
        body['tin'] = tinDigits;
        body['tinType'] = tinType;
      }
      // Always submit the mailing address as a unit so a partial edit
      // doesn't leave the row half-populated.
      const anyAddrField = addrLine1.trim() || addrCity.trim() || addrState.trim() || addrZip.trim();
      body['mailingAddress'] = anyAddrField
        ? {
            line1: addrLine1.trim() || null,
            city: addrCity.trim() || null,
            state: addrState.trim() || null,
            zip: addrZip.trim() || null,
          }
        : null;
      await api(`/practice/1099/vendors/${vendor.contactId}/profile`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });

      // Sync exclusion as a separate call. The backend exposes a
      // dedicated endpoint so the audit log distinguishes "edited
      // 1099 profile" from "marked not 1099-subject" — surface the
      // call only when state changed to keep the audit trail tight.
      const noteTrimmed = exclusionNote.trim() || null;
      const wasExcluded = !!savedExclusion.reason;
      if (excluded) {
        const reasonChanged = savedExclusion.reason !== exclusionReason;
        const noteChanged = (savedExclusion.note ?? null) !== noteTrimmed;
        if (!wasExcluded || reasonChanged || noteChanged) {
          await api(`/practice/1099/vendors/${vendor.contactId}/exclude`, {
            method: 'POST',
            body: JSON.stringify({
              reason: exclusionReason,
              note: noteTrimmed ?? undefined,
            }),
          });
        }
      } else if (wasExcluded) {
        await api(`/practice/1099/vendors/${vendor.contactId}/exclude`, {
          method: 'DELETE',
        });
      }

      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const addressDiffersFromBilling = (() => {
    if (!profile) return false;
    const a = profile.mailingAddress;
    const b = profile.contactBillingAddress;
    const norm = (s: string | null) => (s ?? '').trim();
    return (
      !!(a.line1 || a.city || a.state || a.zip) &&
      (norm(a.line1) !== norm(b.line1) ||
        norm(a.city) !== norm(b.city) ||
        norm(a.state) !== norm(b.state) ||
        norm(a.zip) !== norm(b.zip))
    );
  })();

  return (
    <Modal title={`Edit 1099 profile — ${vendor.displayName}`} onClose={onClose}>
      {!profile ? (
        <div className="py-8 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={is1099Eligible}
              onChange={(e) => setIs1099Eligible(e.target.checked)}
              className="rounded border-gray-300"
            />
            Mark this vendor as 1099-eligible
          </label>

          <fieldset className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <label className="flex items-center gap-2 text-sm text-gray-800 font-medium">
              <input
                type="checkbox"
                checked={excluded}
                onChange={(e) => setExcluded(e.target.checked)}
                className="rounded border-gray-300"
              />
              Not subject to 1099 reporting
            </label>
            <p className="mt-1 ml-6 text-xs text-gray-600">
              Exempts this vendor from filings, the Bulk TIN Match file, threshold review checks,
              and summary tiles. The reason is kept on the audit trail so the firm can defend the
              call at audit time.
            </p>

            {excluded && (
              <div className="mt-2 ml-6 space-y-2">
                <label className="block text-sm">
                  <span className="text-gray-700 font-medium">Reason</span>
                  <select
                    value={exclusionReason}
                    onChange={(e) => setExclusionReason(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                  >
                    {EXCLUSION_REASON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-gray-700 font-medium">
                    Note {exclusionReason === 'other' && <span className="text-red-600">*</span>}
                  </span>
                  <textarea
                    value={exclusionNote}
                    onChange={(e) => setExclusionNote(e.target.value)}
                    rows={2}
                    maxLength={2000}
                    placeholder={
                      exclusionReason === 'other'
                        ? 'Required — describe why this vendor is exempt'
                        : 'Optional context for the audit trail'
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white"
                  />
                </label>
                {savedExclusion.reason && profile.excludedAt && (
                  <p className="text-xs text-gray-500">
                    Currently excluded since{' '}
                    {new Date(profile.excludedAt).toLocaleDateString()}
                    {savedExclusion.reason !== exclusionReason && ' · saving will update the reason'}
                  </p>
                )}
              </div>
            )}
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-sm">
                <span className="text-gray-700 font-medium">
                  Taxpayer ID (TIN) {profile.tinMasked && <span className="text-gray-400">— current: {profile.tinMasked}</span>}
                </span>
                <input
                  type="text"
                  value={tin}
                  onChange={(e) => setTin(e.target.value)}
                  placeholder={profile.tinMasked ? 'Leave blank to keep on file' : '123-45-6789'}
                  inputMode="numeric"
                  maxLength={11}
                  autoComplete="off"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="text-gray-700 font-medium">TIN type</span>
              <select
                value={tinType}
                onChange={(e) => setTinType(e.target.value as 'SSN' | 'EIN')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="SSN">SSN</option>
                <option value="EIN">EIN</option>
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={backupWithholding}
              onChange={(e) => setBackupWithholding(e.target.checked)}
              className="rounded border-gray-300"
            />
            Subject to backup withholding
          </label>

          <label className="block text-sm">
            <span className="text-gray-700 font-medium">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <fieldset className="pt-3 border-t border-gray-100">
            <legend className="text-sm text-gray-900 font-semibold mb-1">
              1099 mailing address
            </legend>
            <p className="text-xs text-gray-500 mb-2">
              Address printed on the 1099. Captured from the W-9 if the vendor submitted one;
              otherwise enter manually. Kept separate from the contact&rsquo;s billing address — use
              the buttons below to copy in either direction.
            </p>
            <label className="block text-sm">
              <span className="text-gray-700 font-medium">Street address</span>
              <input
                type="text"
                value={addrLine1}
                onChange={(e) => setAddrLine1(e.target.value)}
                maxLength={255}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                autoComplete="address-line1"
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
              <label className="block text-sm">
                <span className="text-gray-700 font-medium">City</span>
                <input
                  type="text"
                  value={addrCity}
                  onChange={(e) => setAddrCity(e.target.value)}
                  maxLength={100}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  autoComplete="address-level2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700 font-medium">State</span>
                <input
                  type="text"
                  value={addrState}
                  onChange={(e) => setAddrState(e.target.value)}
                  maxLength={50}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  autoComplete="address-level1"
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-700 font-medium">ZIP</span>
                <input
                  type="text"
                  value={addrZip}
                  onChange={(e) => setAddrZip(e.target.value)}
                  maxLength={20}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  autoComplete="postal-code"
                  inputMode="numeric"
                />
              </label>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copyFromContactBilling}
                className="text-xs px-2 py-1 bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
              >
                Copy from contact billing
              </button>
              <button
                type="button"
                onClick={applyToContact}
                disabled={
                  applying ||
                  !(addrLine1 || addrCity || addrState || addrZip) ||
                  !profile.mailingAddress.line1
                }
                title={
                  !profile.mailingAddress.line1
                    ? 'Save the mailing address first to enable this'
                    : 'Overwrite the contact billing address with the saved 1099 mailing address'
                }
                className="text-xs px-2 py-1 bg-white text-gray-700 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                {applying ? 'Applying…' : 'Apply to contact billing'}
              </button>
              {addressDiffersFromBilling && (
                <span className="text-xs text-amber-700">
                  Differs from contact billing address.
                </span>
              )}
            </div>
          </fieldset>

          {profile.w9OnFile && (
            <p className="text-xs text-gray-500">
              W-9 captured {profile.w9CapturedAt ? new Date(profile.w9CapturedAt).toLocaleDateString() : '—'}
              {profile.w9ExpiresAt &&
                ` · review by ${new Date(profile.w9ExpiresAt).toLocaleDateString()}`}
            </p>
          )}

          {err && (
            <div className="p-2 border border-red-200 bg-red-50 rounded text-sm text-red-700">
              {err}
            </div>
          )}
          {info && (
            <div className="p-2 border border-green-200 bg-green-50 rounded text-sm text-green-800">
              {info}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

type AdjustmentRow = {
  contactId: string;
  displayName: string;
  originalAmount: number | null;
  type: 'keep' | 'C' | 'G';
  newAmount: string;
};

function CorrectionModal({
  filing,
  onClose,
  onFiled,
}: {
  filing: Filing;
  onClose: () => void;
  onFiled: () => void;
}) {
  const [details, setDetails] = useState<FilingDetailRow[] | null>(null);
  const [detailsKnown, setDetailsKnown] = useState<boolean | null>(null);
  const [rows, setRows] = useState<AdjustmentRow[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Manual-entry fields used when the original filing predates 0077
  // and we have no per-vendor snapshot to drive the table.
  const [manualVendors, setManualVendors] = useState<VendorRow[] | null>(null);
  const [manualPicker, setManualPicker] = useState<string>('');
  const [manualType, setManualType] = useState<'C' | 'G'>('C');
  const [manualAmount, setManualAmount] = useState('');

  useEffect(() => {
    let cancelled = false;
    api<{ filing: Filing; details: FilingDetailRow[] | null }>(
      `/practice/1099/filings/${filing.id}`,
    )
      .then((r) => {
        if (cancelled) return;
        if (r.details && r.details.length > 0) {
          setDetails(r.details);
          setDetailsKnown(true);
          setRows(
            r.details.map((d) => ({
              contactId: d.contactId,
              displayName: d.displayName,
              originalAmount: d.amount,
              type: 'keep',
              newAmount: d.amount.toFixed(2),
            })),
          );
        } else {
          setDetails(null);
          setDetailsKnown(false);
        }
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load filing');
      });
    return () => {
      cancelled = true;
    };
  }, [filing.id]);

  // For pre-0077 filings, load the vendor list so the operator can
  // manually pick whom to correct.
  useEffect(() => {
    if (detailsKnown !== false) return;
    let cancelled = false;
    api<{ vendors: VendorRow[] }>(`/practice/1099/vendors?taxYear=${filing.taxYear}`)
      .then((r) => {
        if (!cancelled) setManualVendors(r.vendors);
      })
      .catch(() => {
        if (!cancelled) setManualVendors([]);
      });
    return () => {
      cancelled = true;
    };
  }, [detailsKnown, filing.taxYear]);

  const updateRow = (contactId: string, patch: Partial<AdjustmentRow>) => {
    setRows((prev) =>
      prev.map((r) => (r.contactId === contactId ? { ...r, ...patch } : r)),
    );
  };

  const removeRow = (contactId: string) => {
    setRows((prev) => prev.filter((r) => r.contactId !== contactId));
  };

  const addManualRow = () => {
    if (!manualPicker || !manualVendors) return;
    if (rows.some((r) => r.contactId === manualPicker)) return;
    const v = manualVendors.find((x) => x.contactId === manualPicker);
    if (!v) return;
    setRows((prev) => [
      ...prev,
      {
        contactId: v.contactId,
        displayName: v.displayName,
        originalAmount: null,
        type: manualType,
        newAmount: manualType === 'G' ? '0.00' : manualAmount || '0.00',
      },
    ]);
    setManualPicker('');
    setManualAmount('');
  };

  const submit = async () => {
    setErr(null);
    const adjustments = rows
      .filter((r) => r.type !== 'keep')
      .map((r) => {
        if (r.type === 'G') {
          return { contactId: r.contactId, type: 'G' as const };
        }
        const parsed = Number(r.newAmount);
        if (!Number.isFinite(parsed) || parsed < 0) {
          throw new Error(`Invalid corrected amount for ${r.displayName}`);
        }
        return { contactId: r.contactId, type: 'C' as const, newAmount: parsed };
      });
    if (adjustments.length === 0) {
      setErr('Mark at least one vendor as Corrected (C) or Voided (G).');
      return;
    }
    setSubmitting(true);
    try {
      const result = await api<{ csv: string; vendorCount: number; totalAmount: number; filingId: string }>(
        '/practice/1099/corrections',
        {
          method: 'POST',
          body: JSON.stringify({
            originalFilingId: filing.id,
            adjustments,
            notes: notes.trim() || undefined,
          }),
        },
      );
      const blob = new Blob([result.csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filing.formType}-${filing.taxYear}-correction.csv`;
      a.click();
      URL.revokeObjectURL(url);
      onFiled();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Correction failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Create correction — ${filing.formType} ${filing.taxYear}`} onClose={onClose}>
      {detailsKnown === null ? (
        <div className="py-8 flex justify-center"><LoadingSpinner /></div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-600">
            Corrections amend or void records on a previously filed 1099. Mark each vendor as
            <span className="font-mono px-1">C</span> (corrected amount) or
            <span className="font-mono px-1">G</span> (void — should not have received a 1099).
            Vendors left as <em>Keep</em> are not included in the correction file.
          </p>

          {detailsKnown === false && (
            <div className="p-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded">
              This filing was created before per-vendor snapshots were tracked. Add the vendors you
              want to correct manually below.
            </div>
          )}

          {rows.length > 0 && (
            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-2 py-1 font-medium text-gray-700">Vendor</th>
                    <th className="text-right px-2 py-1 font-medium text-gray-700">Original</th>
                    <th className="text-left px-2 py-1 font-medium text-gray-700">Action</th>
                    <th className="text-right px-2 py-1 font-medium text-gray-700">New amount</th>
                    <th className="px-2 py-1" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r) => (
                    <tr key={r.contactId}>
                      <td className="px-2 py-1 text-gray-900">{r.displayName}</td>
                      <td className="px-2 py-1 text-right text-gray-700">
                        {r.originalAmount === null ? '—' : `$${r.originalAmount.toFixed(2)}`}
                      </td>
                      <td className="px-2 py-1">
                        <select
                          value={r.type}
                          onChange={(e) =>
                            updateRow(r.contactId, {
                              type: e.target.value as AdjustmentRow['type'],
                              newAmount:
                                e.target.value === 'G'
                                  ? '0.00'
                                  : r.originalAmount?.toFixed(2) ?? r.newAmount,
                            })
                          }
                          className="text-xs border border-gray-300 rounded px-1 py-0.5"
                        >
                          {detailsKnown && <option value="keep">Keep</option>}
                          <option value="C">Corrected (C)</option>
                          <option value="G">Voided (G)</option>
                        </select>
                      </td>
                      <td className="px-2 py-1 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          disabled={r.type !== 'C'}
                          value={r.type === 'G' ? '0.00' : r.newAmount}
                          onChange={(e) => updateRow(r.contactId, { newAmount: e.target.value })}
                          className="w-24 text-right text-xs border border-gray-300 rounded px-1 py-0.5 disabled:bg-gray-100"
                        />
                      </td>
                      <td className="px-2 py-1 text-right">
                        {!detailsKnown && (
                          <button
                            type="button"
                            onClick={() => removeRow(r.contactId)}
                            className="text-xs text-red-700 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!detailsKnown && manualVendors && (
            <div className="p-2 border border-gray-200 rounded-md bg-gray-50 space-y-2">
              <div className="text-xs font-medium text-gray-800">Add vendor</div>
              <div className="flex flex-wrap items-end gap-2">
                <select
                  value={manualPicker}
                  onChange={(e) => setManualPicker(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1 min-w-[200px]"
                >
                  <option value="">Select vendor…</option>
                  {manualVendors
                    .filter((v) => v.is1099Eligible)
                    .map((v) => (
                      <option key={v.contactId} value={v.contactId}>
                        {v.displayName}
                      </option>
                    ))}
                </select>
                <select
                  value={manualType}
                  onChange={(e) => setManualType(e.target.value as 'C' | 'G')}
                  className="text-xs border border-gray-300 rounded px-2 py-1"
                >
                  <option value="C">Corrected (C)</option>
                  <option value="G">Voided (G)</option>
                </select>
                {manualType === 'C' && (
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Amount"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    className="w-24 text-xs border border-gray-300 rounded px-2 py-1"
                  />
                )}
                <button
                  type="button"
                  onClick={addManualRow}
                  disabled={!manualPicker}
                  className="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          <label className="block text-xs">
            <span className="text-gray-700 font-medium">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Reason for the correction (kept on the audit trail)"
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>

          {err && (
            <div className="p-2 border border-red-200 bg-red-50 rounded text-sm text-red-700">
              {err}
            </div>
          )}

          <p className="text-xs text-gray-500">
            Owner role required. Submitting downloads the correction CSV and records the filing in
            history. The original filing remains untouched.
          </p>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || (details === null && rows.length === 0)}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-60"
            >
              {submitting ? 'Filing…' : 'Download correction CSV'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// 1099 account-mapping catalog. Mirrors the closed enum in
// packages/api/src/services/portal-1099.boxes.ts — keep the two
// in sync (UI label here is what the dropdown displays).
const FORM_BOX_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'NEC-1', label: '1099-NEC Box 1 — Nonemployee compensation' },
  { value: 'MISC-1', label: '1099-MISC Box 1 — Rents' },
  { value: 'MISC-2', label: '1099-MISC Box 2 — Royalties' },
  { value: 'MISC-3', label: '1099-MISC Box 3 — Other income' },
  { value: 'MISC-6', label: '1099-MISC Box 6 — Medical & health care payments' },
  { value: 'MISC-10', label: '1099-MISC Box 10 — Gross proceeds paid to attorney' },
];

const FORM_BOX_LABEL: Record<string, string> = Object.fromEntries(
  FORM_BOX_OPTIONS.map((o) => [o.value, o.label]),
);

interface MappingAccount {
  id: string;
  accountNumber: string | null;
  name: string;
}

interface MappingGroup {
  formBox: string;
  label: string;
  accounts: MappingAccount[];
}

interface MappingsView {
  mappings: MappingGroup[];
  unmapped: MappingAccount[];
}

function AccountMappingPanel() {
  const [view, setView] = useState<MappingsView | null>(null);
  const [selectedBox, setSelectedBox] = useState<string>(FORM_BOX_OPTIONS[0]!.value);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setErr(null);
    try {
      const v = await api<MappingsView>('/practice/1099/account-mappings');
      setView(v);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load mappings.');
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // When the selected box changes, pre-check the accounts already
  // in that box so the operator sees the current state.
  useEffect(() => {
    if (!view) return;
    const group = view.mappings.find((g) => g.formBox === selectedBox);
    setChecked(new Set(group ? group.accounts.map((a) => a.id) : []));
    setInfo(null);
  }, [selectedBox, view]);

  // "Where is this account currently mapped?" lookup, used to
  // render the inline "currently in OTHER_BOX" warning so the
  // operator knows checking will move it.
  const accountToBox = useMemo(() => {
    const map = new Map<string, string>();
    if (!view) return map;
    for (const group of view.mappings) {
      for (const a of group.accounts) map.set(a.id, group.formBox);
    }
    return map;
  }, [view]);

  // The full candidate list for the checklist = every expense
  // account, regardless of whether it's currently in any box.
  const allAccounts = useMemo<MappingAccount[]>(() => {
    if (!view) return [];
    const merged: MappingAccount[] = [...view.unmapped];
    for (const g of view.mappings) merged.push(...g.accounts);
    merged.sort((a, b) => {
      const an = a.accountNumber ?? '';
      const bn = b.accountNumber ?? '';
      if (an && bn && an !== bn) return an.localeCompare(bn);
      return a.name.localeCompare(b.name);
    });
    return merged;
  }, [view]);

  const totalMapped = useMemo(() => {
    if (!view) return 0;
    return view.mappings.reduce((s, g) => s + g.accounts.length, 0);
  }, [view]);

  const totalAccounts = allAccounts.length;

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setErr(null);
    setInfo(null);
    setSaving(true);
    try {
      await api(`/practice/1099/account-mappings/${encodeURIComponent(selectedBox)}`, {
        method: 'PUT',
        body: JSON.stringify({ accountIds: [...checked] }),
      });
      await reload();
      setInfo('Mapping saved.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to save mapping.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-8 border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">1099 account mapping</h2>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Tag each expense account with the 1099 box payments to it should be reported under.
            One account can only sit in one box at a time — checking it here moves it from
            wherever it currently lives.
          </p>
        </div>
        {view && (
          <div className="text-xs text-gray-500">
            {totalMapped} of {totalAccounts} expense account{totalAccounts === 1 ? '' : 's'} mapped
          </div>
        )}
      </div>

      {!view ? (
        <div className="py-8 flex justify-center"><LoadingSpinner /></div>
      ) : totalAccounts === 0 ? (
        <p className="text-sm text-gray-500">
          No active expense accounts found in this tenant.
        </p>
      ) : (
        <>
          <label className="block text-sm mb-3 max-w-md">
            <span className="text-gray-700 font-medium">Form / box</span>
            <select
              value={selectedBox}
              onChange={(e) => setSelectedBox(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {FORM_BOX_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          <div className="border border-gray-200 rounded-md max-h-72 overflow-y-auto">
            <ul className="divide-y divide-gray-100">
              {allAccounts.map((a) => {
                const currentBox = accountToBox.get(a.id);
                const isChecked = checked.has(a.id);
                const elsewhere = currentBox && currentBox !== selectedBox;
                return (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggle(a.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="font-mono text-xs text-gray-500 w-16 shrink-0">
                      {a.accountNumber ?? '—'}
                    </span>
                    <span className="text-gray-900">{a.name}</span>
                    {elsewhere && !isChecked && (
                      <span className="ml-auto text-xs text-amber-700">
                        currently in {FORM_BOX_LABEL[currentBox] ?? currentBox}
                      </span>
                    )}
                    {elsewhere && isChecked && (
                      <span className="ml-auto text-xs text-amber-700">
                        will move from {FORM_BOX_LABEL[currentBox] ?? currentBox}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {err && (
            <div className="mt-3 p-2 border border-red-200 bg-red-50 rounded text-sm text-red-700">
              {err}
            </div>
          )}
          {info && (
            <div className="mt-3 p-2 border border-green-200 bg-green-50 rounded text-sm text-green-800">
              {info}
            </div>
          )}

          <div className="mt-3 flex items-center justify-end">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save mapping'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export default Tax1099Page;
