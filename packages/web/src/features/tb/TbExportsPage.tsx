// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tax exports (Phase 11): pre-export validation panel, per-software
// generation, and the export history with staleness indicators.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, isApiError } from '../../api/client';
import { useTbProfile } from '../../api/hooks/useTb';
import { useTbYearOverride } from './workpaperShared';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toaster';
import { Download } from 'lucide-react';

const SOFTWARE = [
  { id: 'ultratax', label: 'UltraTax CS', ext: 'xlsx' },
  { id: 'lacerte', label: 'Lacerte', ext: 'csv' },
  { id: 'cch', label: 'CCH Axcess', ext: 'csv' },
  { id: 'gosystem', label: 'GoSystem RS', ext: 'csv' },
  { id: 'generic', label: 'Generic CSV', ext: 'csv' },
  { id: 'workingtb', label: 'Excel Working TB', ext: 'xlsx' },
] as const;

interface Validation {
  balanced: boolean;
  unassigned: Array<{ accountId: string; name: string }>;
  missingVendorCode: Array<{ code: string; description: string }>;
  splitGaps: number;
  hardBlocked: boolean;
  overridableBlocked: boolean;
  ready: boolean;
}

interface DatasetLine {
  key: string;
  code: string;
  description: string;
  accountCount: number;
  bookAmount: number;
  taxAmount: number;
  consolidated: { exportCode: string; description: string } | null;
  accounts: Array<{ accountNumber: string | null; name: string; amount: number }>;
}

interface ExportRecord {
  id: string;
  taxYear: number;
  software: string;
  basis: string;
  glVersionStamp: number;
  overrideUsed: boolean;
  fileName: string;
  rowCount: number;
  createdAt: string;
}

export function TbExportsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: profileData } = useTbProfile();
  const [taxYear, setTaxYear] = useTbYearOverride();
  const [basis, setBasis] = useState<'accrual' | 'cash'>('accrual');
  const [software, setSoftware] = useState<string>('ultratax');
  const effYear = taxYear ?? profileData?.fiscal.currentTaxYear ?? new Date().getFullYear();

  const { data: validationData, isLoading: validating } = useQuery({
    queryKey: ['tb', 'export-validate', effYear, basis, software],
    enabled: software !== 'workingtb',
    retry: false,
    queryFn: () => apiClient<{ validation: Validation; lineCount: number; lines: DatasetLine[] }>(
      `/tb/exports/validate?taxYear=${effYear}&basis=${basis}&software=${software}`,
    ),
  });

  // ── Consolidation options (Vibe TB parity) ────────────────────
  const { data: consolidationData } = useQuery({
    queryKey: ['tb', 'consolidation'],
    queryFn: () => apiClient<{ prefs: Record<string, { exportCode: string; description: string }> }>('/tb/exports/consolidation'),
  });
  const [prefsDraft, setPrefsDraft] = useState<Record<string, { exportCode: string; description: string }> | null>(null);
  const prefs = prefsDraft ?? consolidationData?.prefs ?? {};
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const savePrefs = useMutation({
    mutationFn: (next: Record<string, { exportCode: string; description: string }>) =>
      apiClient('/tb/exports/consolidation', { method: 'PUT', body: JSON.stringify({ prefs: next }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tb', 'consolidation'] });
      queryClient.invalidateQueries({ queryKey: ['tb', 'export-validate'] });
      toast.success('Consolidation saved');
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'Save failed'),
  });
  const setPref = (key: string, pref: { exportCode: string; description: string } | null) => {
    setPrefsDraft((cur) => {
      const next = { ...(cur ?? consolidationData?.prefs ?? {}) };
      if (pref) next[key] = pref; else delete next[key];
      return next;
    });
  };
  const dirty = prefsDraft !== null;

  const { data: historyData } = useQuery({
    queryKey: ['tb', 'exports'],
    queryFn: () => apiClient<{ exports: ExportRecord[]; glVersionStamp: number }>('/tb/exports'),
  });

  const generate = useMutation({
    mutationFn: (overrideConfirmed?: boolean) =>
      apiClient<{ export: ExportRecord }>('/tb/exports', {
        method: 'POST',
        body: JSON.stringify({ taxYear: effYear, basis, software, overrideConfirmed }),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tb', 'exports'] });
      toast.success(`${res.export.fileName} generated`);
      downloadFile(res.export.id, res.export.fileName);
    },
    onError: (e) => {
      if (isApiError(e) && (e.details as { canOverride?: boolean } | undefined)?.canOverride) {
        if (window.confirm('The trial balance is out of balance. Export anyway? (Firm-admin override, audit-logged.)')) {
          generate.mutate(true);
          return;
        }
      }
      toast.error(isApiError(e) ? e.message : 'Export failed');
    },
  });

  const downloadFile = async (id: string, fileName: string) => {
    const res = await fetch(`${import.meta.env.BASE_URL}api/v1/tb/exports/${id}/download`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        'X-Company-Id': localStorage.getItem('activeCompanyId') ?? '',
      },
    });
    if (!res.ok) {
      toast.error('Download failed');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const v = validationData?.validation;
  const currentStamp = historyData?.glVersionStamp;
  const softwareMeta = SOFTWARE.find((s) => s.id === software)!;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Tax Exports</h1>
        <p className="text-sm text-gray-500">Tax-basis balances with software-specific line codes. Validation must pass before a vendor file generates.</p>
      </div>

      {/* ── Pre-export validation ─────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-base font-medium text-gray-900 mb-3">Pre-export validation</h2>
        <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
          <label className="text-gray-700" htmlFor="exp-software">Tax software</label>
          <select id="exp-software" value={software} onChange={(e) => setSoftware(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2">
            {SOFTWARE.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <input type="number" value={effYear} aria-label="Tax year"
            onChange={(e) => { const v = Number(e.target.value); if (v >= 2000 && v <= 2100) setTaxYear(v); }}
            className="w-24 rounded-lg border border-gray-300 px-3 py-2" />
          <select value={basis} aria-label="Basis" onChange={(e) => setBasis(e.target.value as 'accrual' | 'cash')}
            className="rounded-lg border border-gray-300 px-2 py-2">
            <option value="accrual">Accrual</option>
            <option value="cash">Cash</option>
          </select>
        </div>

        {software === 'workingtb' ? (
          <p className="text-sm text-gray-600 mb-3">The Excel working trial balance exports all five columns with tax codes — no vendor validation needed.</p>
        ) : validating ? (
          <LoadingSpinner className="py-4" />
        ) : v ? (
          <dl className="space-y-1.5 text-sm mb-3">
            <ValRow label="Balance status" ok={v.balanced} okText="Balanced" badText="Out of balance (firm-admin override possible)" />
            <ValRow label="Unmapped accounts" ok={v.unassigned.length === 0} okText="None"
              badText={v.unassigned.slice(0, 5).map((u) => u.name).join(', ') + (v.unassigned.length > 5 ? '…' : '')} />
            <ValRow label="Software codes" ok={v.missingVendorCode.length === 0} okText="All mapped"
              badText={`Missing ${softwareMeta.label} code: ${v.missingVendorCode.slice(0, 5).map((m) => m.code).join(', ')}${v.missingVendorCode.length > 5 ? '…' : ''}`} />
            <ValRow label="Activity splits" ok={v.splitGaps === 0} okText="Resolved" badText={`${v.splitGaps} unit(s) without a resolvable code`} />
          </dl>
        ) : (
          <p className="text-sm text-amber-700 mb-3">Validation unavailable — set the tax profile and assignments first.</p>
        )}
        {software !== 'workingtb' && v?.ready && (
          <p className="text-sm text-green-700 mb-3">All checks passed — ready to export.</p>
        )}
        <Button
          disabled={generate.isPending || (software !== 'workingtb' && (v?.hardBlocked ?? true))}
          loading={generate.isPending}
          onClick={() => generate.mutate(undefined)}>
          <Download className="h-4 w-4 mr-1" /> Download {softwareMeta.label} export
        </Button>
        <p className="text-xs text-gray-400 mt-2">Downloads as .{softwareMeta.ext}. DONOTMAP lines are excluded from vendor files.</p>
      </div>

      {/* ── Consolidation options (Vibe TB parity) ────────── */}
      {software !== 'workingtb' && (validationData?.lines ?? []).length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <h2 className="text-base font-medium text-gray-900">Consolidation options</h2>
            <div className="flex items-center gap-3">
              {dirty
                ? <Button size="sm" loading={savePrefs.isPending}
                    onClick={() => savePrefs.mutate(prefs, { onSuccess: () => setPrefsDraft(null) })}>Save</Button>
                : <span className="text-xs text-green-700">Saved</span>}
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            {Object.keys(prefs).length} tax code{Object.keys(prefs).length === 1 ? '' : 's'} consolidated —
            checked codes export as a single line under your custom code instead of per-account rows.
          </p>
          <div className="flex items-center gap-3 text-sm mb-2">
            <button className="text-blue-700 hover:underline"
              onClick={() => {
                const next = { ...prefs };
                for (const l of validationData?.lines ?? []) {
                  if (l.accountCount > 1 && !next[l.key]) next[l.key] = { exportCode: l.code, description: l.description };
                }
                setPrefsDraft(next);
              }}>
              Select all multi-account
            </button>
            <button className="text-gray-500 hover:underline" onClick={() => setPrefsDraft({})}>Clear all</button>
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200 sticky top-0 bg-white">
                  <th className="py-2 pr-2 w-8" />
                  <th className="py-2 pr-3">Tax code</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3 text-right">Accts</th>
                  <th className="py-2 pr-3 text-right">Book basis</th>
                  <th className="py-2 pr-3 text-right">Tax basis</th>
                </tr>
              </thead>
              <tbody>
                {(validationData?.lines ?? []).map((l) => {
                  const pref = prefs[l.key] ?? null;
                  const isOpen = expanded.has(l.key);
                  return (
                    <FragmentRow key={l.key} line={l} pref={pref} isOpen={isOpen}
                      onToggleOpen={() => setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(l.key)) next.delete(l.key); else next.add(l.key);
                        return next;
                      })}
                      onToggle={(checked) => setPref(l.key, checked ? { exportCode: pref?.exportCode || l.code, description: pref?.description || l.description } : null)}
                      onEdit={(field, value) => pref && setPref(l.key, { ...pref, [field]: value })} />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── History (11.9) ───────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-base font-medium text-gray-900 mb-3">Export history</h2>
        {(historyData?.exports ?? []).length === 0 && <p className="text-sm text-gray-500">No exports yet.</p>}
        {(historyData?.exports ?? []).length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3">File</th>
                <th className="py-2 pr-3">TY</th>
                <th className="py-2 pr-3">Basis</th>
                <th className="py-2 pr-3">Generated</th>
                <th className="py-2 pr-3">Freshness</th>
                <th className="py-2 text-right" />
              </tr>
            </thead>
            <tbody>
              {historyData!.exports.map((e) => {
                const drift = currentStamp !== undefined ? currentStamp - e.glVersionStamp : 0;
                return (
                  <tr key={e.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3">
                      {e.fileName}
                      {e.overrideUsed && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700" title="Generated with a firm-admin balance override">override</span>}
                    </td>
                    <td className="py-2 pr-3">{e.taxYear}</td>
                    <td className="py-2 pr-3">{e.basis}</td>
                    <td className="py-2 pr-3">{new Date(e.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-3">
                      {drift > 0
                        ? <span className="text-xs text-amber-700" title="The GL changed after this file was generated">⚠ {drift} change{drift === 1 ? '' : 's'} since</span>
                        : <span className="text-xs text-green-700">current</span>}
                    </td>
                    <td className="py-2 text-right">
                      <button className="text-xs text-blue-600 underline" onClick={() => downloadFile(e.id, e.fileName)}>download</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ValRow({ label, ok, okText, badText }: { label: string; ok: boolean; okText: string; badText: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-40 text-gray-500">{label}</dt>
      <dd className={ok ? 'text-green-700' : 'text-red-700'}>{ok ? `✓ ${okText}` : badText}</dd>
    </div>
  );
}


// One consolidation row: checkbox + expandable member accounts +
// "Export as" custom code/description when consolidated.
function FragmentRow({ line, pref, isOpen, onToggleOpen, onToggle, onEdit }: {
  line: DatasetLine;
  pref: { exportCode: string; description: string } | null;
  isOpen: boolean;
  onToggleOpen: () => void;
  onToggle: (checked: boolean) => void;
  onEdit: (field: 'exportCode' | 'description', value: string) => void;
}) {
  const usd = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <>
      <tr className={`border-b border-gray-100 ${pref ? 'bg-blue-50/40' : ''}`}>
        <td className="py-1.5 pr-2">
          <span className="flex items-center gap-1">
            <input type="checkbox" checked={!!pref} aria-label={`Consolidate ${line.code}`}
              onChange={(e) => onToggle(e.target.checked)} />
            {line.accountCount > 1 && (
              <button onClick={onToggleOpen} className="text-gray-400 hover:text-gray-700 text-xs" aria-label="Expand accounts">
                {isOpen ? '▾' : '▸'}
              </button>
            )}
          </span>
        </td>
        <td className="py-1.5 pr-3 font-mono text-xs">{line.code}</td>
        <td className="py-1.5 pr-3">{line.description}</td>
        <td className="py-1.5 pr-3 text-right tabular-nums">{line.accountCount}</td>
        <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-xs">{usd(line.bookAmount)}</td>
        <td className="py-1.5 pr-3 text-right font-mono tabular-nums text-xs">{usd(line.taxAmount)}</td>
      </tr>
      {pref && (
        <tr className="border-b border-gray-100 bg-blue-50/20">
          <td />
          <td colSpan={5} className="py-1.5 pr-3">
            <span className="inline-flex items-center gap-2 text-xs text-gray-600">
              Export as:
              <input value={pref.exportCode} onChange={(e) => onEdit('exportCode', e.target.value)}
                aria-label="Custom export code"
                className="w-28 rounded border border-gray-300 px-2 py-1 text-xs font-mono" />
              <input value={pref.description} onChange={(e) => onEdit('description', e.target.value)}
                aria-label="Custom export description" placeholder="Description"
                className="w-72 rounded border border-gray-300 px-2 py-1 text-xs" />
            </span>
          </td>
        </tr>
      )}
      {isOpen && line.accounts.map((a, i) => (
        <tr key={i} className="border-b border-gray-50 text-xs text-gray-500">
          <td /><td className="py-1 pr-3 font-mono">{a.accountNumber ?? ''}</td>
          <td className="py-1 pr-3">{a.name}</td>
          <td /><td />
          <td className="py-1 pr-3 text-right font-mono tabular-nums">{usd(a.amount)}</td>
        </tr>
      ))}
    </>
  );
}
