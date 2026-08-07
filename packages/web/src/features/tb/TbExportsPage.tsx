// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tax exports (Phase 11): pre-export validation panel, per-software
// generation, and the export history with staleness indicators.

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, isApiError } from '../../api/client';
import { useTbProfile } from '../../api/hooks/useTb';
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
  const [taxYear, setTaxYear] = useState<number | null>(null);
  const [basis, setBasis] = useState<'accrual' | 'cash'>('accrual');
  const [software, setSoftware] = useState<string>('ultratax');
  const effYear = taxYear ?? profileData?.fiscal.currentTaxYear ?? new Date().getFullYear();

  const { data: validationData, isLoading: validating } = useQuery({
    queryKey: ['tb', 'export-validate', effYear, basis, software],
    enabled: software !== 'workingtb',
    retry: false,
    queryFn: () => apiClient<{ validation: Validation; lineCount: number }>(
      `/tb/exports/validate?taxYear=${effYear}&basis=${basis}&software=${software}`,
    ),
  });

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
            onChange={(e) => setTaxYear(Number(e.target.value))}
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
