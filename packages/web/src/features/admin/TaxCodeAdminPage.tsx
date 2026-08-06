// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Super-admin surface for the global tax-code seed library (TB module
// Phase 2, ADR-TB-05): version history, upload → dry-run diff →
// confirm import, and a crosswalk browser. Firm custom codes are NOT
// managed here — they live with the firm's own TB settings.

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tbSeedReturnForms, tbActivityTypes } from '@kis-books/shared';
import { apiClient } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';

interface SeedVersion {
  id: string;
  taxYear: number;
  version: number;
  label: string | null;
  sourceFileHash: string;
  rowCount: number;
  importedAt: string;
}

interface SeedDiff {
  added: number;
  changed: number;
  removed: number;
  samples: { added: string[]; changed: string[]; removed: string[] };
}

interface ImportResult {
  unchanged: boolean;
  dryRun?: boolean;
  version?: number;
  rowCount?: number;
  diff?: SeedDiff & { priorVersion: number | null };
}

interface SeedCode {
  id: string;
  returnForm: string;
  activityType: string;
  code: string;
  description: string;
  sortOrder: number;
  isM1Adjustment: boolean;
  ultrataxCode: string | null;
  cchCode: string | null;
  lacerteCode: string | null;
  gosystemCode: string | null;
  genericCode: string | null;
}

const PAGE_SIZE = 100;

async function uploadSeed(file: File, taxYear: string, label: string, dryRun: boolean): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('taxYear', taxYear);
  if (label) formData.append('label', label);
  formData.append('dryRun', String(dryRun));
  const res = await fetch(`${import.meta.env.BASE_URL}api/v1/admin/tb/seed-versions/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
    body: formData,
  });
  const body = await res.json();
  if (!res.ok) {
    const details = body?.error?.details?.errors as string[] | undefined;
    throw new Error(details?.slice(0, 5).join('\n') ?? body?.error?.message ?? 'Import failed');
  }
  return body as ImportResult;
}

export function TaxCodeAdminPage() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear() - 1));
  const [label, setLabel] = useState('');
  const [dryRunResult, setDryRunResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Browser state
  const [versionId, setVersionId] = useState('');
  const [returnForm, setReturnForm] = useState('');
  const [activityType, setActivityType] = useState('');
  const [search, setSearch] = useState('');
  const [m1Only, setM1Only] = useState(false);
  const [page, setPage] = useState(0);

  const { data: versionsResp, isLoading: versionsLoading, isError: versionsError, refetch: refetchVersions } = useQuery({
    queryKey: ['admin', 'tb', 'seed-versions'],
    queryFn: () => apiClient<{ versions: SeedVersion[] }>('/admin/tb/seed-versions'),
  });

  const effectiveVersionId = versionId || versionsResp?.versions[0]?.id || '';

  const { data: codesResp, isLoading: codesLoading } = useQuery({
    queryKey: ['admin', 'tb', 'codes', effectiveVersionId, returnForm, activityType, search, m1Only, page],
    enabled: !!effectiveVersionId,
    queryFn: () => {
      const params = new URLSearchParams({ versionId: effectiveVersionId, limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE) });
      if (returnForm) params.set('returnForm', returnForm);
      if (activityType) params.set('activityType', activityType);
      if (search) params.set('search', search);
      if (m1Only) params.set('m1Only', 'true');
      return apiClient<{ codes: SeedCode[]; total: number }>(`/admin/tb/codes?${params}`);
    },
  });

  const importMutation = useMutation({
    mutationFn: ({ dryRun }: { dryRun: boolean }) => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error('Choose a seed .xlsx file first');
      return uploadSeed(file, taxYear, label, dryRun);
    },
    onSuccess: (result, { dryRun }) => {
      setImportError(null);
      if (dryRun || result.unchanged) {
        setDryRunResult(result);
      } else {
        setDryRunResult(null);
        if (fileRef.current) fileRef.current.value = '';
        queryClient.invalidateQueries({ queryKey: ['admin', 'tb'] });
      }
    },
    onError: (err) => {
      setDryRunResult(null);
      setImportError(err instanceof Error ? err.message : 'Import failed');
    },
  });

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Tax Code Management</h1>
      <p className="text-gray-600 mb-6">
        System-wide tax code library and vendor crosswalk (Trial Balance module). Seed versions are
        immutable — importing an updated file creates a new version; firm custom codes are never touched.
      </p>

      {/* ── Import ──────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-3">Import seed file</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="seed-file">Seed .xlsx</label>
            <input id="seed-file" ref={fileRef} type="file" accept=".xlsx" className="block text-sm" onChange={() => { setDryRunResult(null); setImportError(null); }} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="seed-year">Tax year</label>
            <input id="seed-year" type="number" value={taxYear} onChange={(e) => setTaxYear(e.target.value)}
              className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div className="grow max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="seed-label">Label (optional)</label>
            <input id="seed-label" type="text" value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. IRS final revision" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <Button variant="secondary" disabled={importMutation.isPending}
            onClick={() => importMutation.mutate({ dryRun: true })}>
            Dry run
          </Button>
          <Button variant="primary" disabled={importMutation.isPending || !dryRunResult || dryRunResult.unchanged}
            onClick={() => importMutation.mutate({ dryRun: false })}>
            Confirm import
          </Button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Run a dry run first — Confirm unlocks after the diff is reviewed.</p>

        {importError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 whitespace-pre-line">
            {importError}
          </div>
        )}
        {dryRunResult?.unchanged && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            This exact file is already imported (byte-identical) — nothing to do.
          </div>
        )}
        {dryRunResult && !dryRunResult.unchanged && dryRunResult.diff && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-900">
            <div className="font-medium mb-1">
              Dry run: {dryRunResult.rowCount} rows · vs {dryRunResult.diff.priorVersion ? `v${dryRunResult.diff.priorVersion}` : 'no prior version'} —{' '}
              {dryRunResult.diff.added} added, {dryRunResult.diff.changed} changed, {dryRunResult.diff.removed} removed
            </div>
            {(['added', 'changed', 'removed'] as const).map((k) =>
              dryRunResult.diff!.samples[k].length > 0 ? (
                <div key={k} className="text-xs font-mono text-blue-800">
                  {k}: {dryRunResult.diff!.samples[k].join(', ')}{dryRunResult.diff![k] > dryRunResult.diff!.samples[k].length ? ' …' : ''}
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>

      {/* ── Versions ────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-3">Seed versions</h2>
        {versionsLoading && <LoadingSpinner className="py-6" />}
        {versionsError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            Failed to load versions.
            <button onClick={() => refetchVersions()} className="ml-2 underline font-medium">Retry</button>
          </div>
        )}
        {versionsResp && versionsResp.versions.length === 0 && (
          <p className="text-sm text-gray-500">No seed versions imported yet. Run <code className="font-mono">npm run seed:tax-codes -w @kis-books/api -- 2025</code> or upload above.</p>
        )}
        {versionsResp && versionsResp.versions.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-4">Tax year</th>
                <th className="py-2 pr-4">Version</th>
                <th className="py-2 pr-4">Label</th>
                <th className="py-2 pr-4">Rows</th>
                <th className="py-2 pr-4">Imported</th>
                <th className="py-2">File hash</th>
              </tr>
            </thead>
            <tbody>
              {versionsResp.versions.map((v) => (
                <tr key={v.id} className="border-b border-gray-100">
                  <td className="py-2 pr-4">{v.taxYear}</td>
                  <td className="py-2 pr-4">v{v.version}</td>
                  <td className="py-2 pr-4">{v.label ?? '—'}</td>
                  <td className="py-2 pr-4 tabular-nums">{v.rowCount.toLocaleString()}</td>
                  <td className="py-2 pr-4">{new Date(v.importedAt).toLocaleString()}</td>
                  <td className="py-2 font-mono text-xs text-gray-500">{v.sourceFileHash.slice(0, 12)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Browser ─────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-medium text-gray-900 mb-3">Browse codes</h2>
        <div className="flex flex-wrap gap-3 mb-4">
          <select value={effectiveVersionId} onChange={(e) => { setVersionId(e.target.value); setPage(0); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm" aria-label="Seed version">
            {(versionsResp?.versions ?? []).map((v) => (
              <option key={v.id} value={v.id}>TY{v.taxYear} v{v.version}</option>
            ))}
          </select>
          <select value={returnForm} onChange={(e) => { setReturnForm(e.target.value); setPage(0); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm" aria-label="Return form">
            <option value="">All forms</option>
            {tbSeedReturnForms.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={activityType} onChange={(e) => { setActivityType(e.target.value); setPage(0); }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm" aria-label="Activity type">
            <option value="">All activities</option>
            {tbActivityTypes.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search code or description…" className="grow max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={m1Only} onChange={(e) => { setM1Only(e.target.checked); setPage(0); }} />
            M-1 adjustments only
          </label>
        </div>

        {codesLoading && <LoadingSpinner className="py-6" />}
        {codesResp && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                    <th className="py-2 pr-3">Form</th>
                    <th className="py-2 pr-3">Activity</th>
                    <th className="py-2 pr-3">Code</th>
                    <th className="py-2 pr-3">Description</th>
                    <th className="py-2 pr-3">Sort</th>
                    <th className="py-2 pr-3">M-1</th>
                    <th className="py-2 pr-3">UltraTax</th>
                    <th className="py-2 pr-3">CCH</th>
                    <th className="py-2 pr-3">Lacerte</th>
                    <th className="py-2 pr-3">GoSystem</th>
                  </tr>
                </thead>
                <tbody>
                  {codesResp.codes.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100">
                      <td className="py-1.5 pr-3">{c.returnForm}</td>
                      <td className="py-1.5 pr-3">{c.activityType}</td>
                      <td className="py-1.5 pr-3 font-mono">{c.code}</td>
                      <td className="py-1.5 pr-3 max-w-md truncate whitespace-normal" title={c.description}>{c.description}</td>
                      <td className="py-1.5 pr-3 tabular-nums">{c.sortOrder}</td>
                      <td className="py-1.5 pr-3">{c.isM1Adjustment ? 'Yes' : '—'}</td>
                      <td className="py-1.5 pr-3 font-mono text-xs">{c.ultrataxCode ?? '—'}</td>
                      <td className="py-1.5 pr-3 font-mono text-xs">{c.cchCode ?? '—'}</td>
                      <td className="py-1.5 pr-3 font-mono text-xs">{c.lacerteCode ?? '—'}</td>
                      <td className="py-1.5 pr-3 font-mono text-xs">{c.gosystemCode ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {codesResp.codes.length === 0 && (
              <p className="text-sm text-gray-500 py-4">No codes match these filters.</p>
            )}
            <div className="mt-3">
              <Pagination
                total={codesResp.total}
                limit={PAGE_SIZE}
                offset={page * PAGE_SIZE}
                onChange={(offset) => setPage(Math.floor(offset / PAGE_SIZE))}
                unit="codes"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
