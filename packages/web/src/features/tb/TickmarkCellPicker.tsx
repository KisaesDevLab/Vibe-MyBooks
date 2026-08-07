// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Cell-level tickmark popup shared by the popout live view (click an
// Adjusted/Tax amount) and the workpaper's Tickmark column. Lists the
// firm's tickmark library, applies/removes marks for one account +
// workpaper column + tax year, and invalidates the shared queries so
// chips update everywhere (workpaper, popout, leadsheets, reports).

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, isApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toaster';
import { MARK_TONES } from './workpaperShared';

interface Tickmark { id: string; symbol: string; description: string; color: string | null }
interface TickmarkApplication { id: string; accountId: string; column: string; tickmarkId: string }

const COLUMN_LABELS: Record<string, string> = {
  unadjusted: 'Unadjusted', aje: 'AJE', adjusted: 'Adjusted', tax_rje: 'Tax RJE', tax: 'Tax',
};

export function TickmarkCellPicker({ accountId, accountName, taxYear, initialColumn, allowColumnChange = false, onClose }: {
  accountId: string;
  accountName: string;
  taxYear: number;
  initialColumn: 'unadjusted' | 'aje' | 'adjusted' | 'tax_rje' | 'tax';
  allowColumnChange?: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [column, setColumn] = useState<string>(initialColumn);

  const { data: marksData, isLoading: marksLoading } = useQuery({
    queryKey: ['tb', 'tickmarks'],
    queryFn: () => apiClient<{ tickmarks: Tickmark[] }>('/tb/tickmarks'),
  });
  const { data: appsData } = useQuery({
    queryKey: ['tb', 'tickmark-applications', taxYear],
    queryFn: () => apiClient<{ applications: TickmarkApplication[] }>(`/tb/tickmark-applications?taxYear=${taxYear}`),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['tb', 'tickmark-applications'] });
  const err = (e: unknown) => toast.error(isApiError(e) ? e.message : 'Operation failed');

  const apply = useMutation({
    mutationFn: (tickmarkId: string) =>
      apiClient('/tb/tickmark-applications', {
        method: 'POST',
        body: JSON.stringify({ accountId, column, tickmarkId, taxYear }),
      }),
    onSuccess: invalidate,
    onError: err,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient(`/tb/tickmark-applications/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
    onError: err,
  });
  const seedDefaults = useMutation({
    mutationFn: () => apiClient('/tb/tickmarks/seed-defaults', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tb', 'tickmarks'] }),
    onError: err,
  });

  const marks = marksData?.tickmarks ?? [];
  const appliedHere = (appsData?.applications ?? []).filter((a) => a.accountId === accountId && a.column === column);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-base font-medium text-gray-900">Tickmarks — {accountName}</h2>
            <p className="text-xs text-gray-500">
              {allowColumnChange ? (
                <select value={column} onChange={(e) => setColumn(e.target.value)} aria-label="Workpaper column"
                  className="mt-1 rounded border border-gray-300 px-1.5 py-0.5 text-xs">
                  {Object.entries(COLUMN_LABELS).map(([k, label]) => <option key={k} value={k}>{label} column</option>)}
                </select>
              ) : `${COLUMN_LABELS[column] ?? column} column · TY${taxYear}`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">✕</button>
        </div>
        <div className="p-4 overflow-y-auto grow">
          {marksLoading && <LoadingSpinner className="py-6" />}
          {!marksLoading && marks.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">No tickmark library yet.</p>
              <Button size="sm" variant="secondary" loading={seedDefaults.isPending} onClick={() => seedDefaults.mutate()}>
                Load standard tickmarks
              </Button>
            </div>
          )}
          <ul className="space-y-1">
            {marks.map((m) => {
              const applied = appliedHere.find((a) => a.tickmarkId === m.id);
              return (
                <li key={m.id}>
                  <button
                    className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm border ${applied ? 'border-blue-300 bg-blue-50' : 'border-transparent hover:bg-gray-50'}`}
                    disabled={apply.isPending || remove.isPending}
                    onClick={() => applied ? remove.mutate(applied.id) : apply.mutate(m.id)}
                    title={applied ? 'Click to remove' : 'Click to apply'}>
                    <span className={`inline-flex items-center justify-center h-6 min-w-6 px-1 rounded text-xs font-semibold ${MARK_TONES[m.color ?? 'gray'] ?? MARK_TONES['gray']}`}>
                      {m.symbol}
                    </span>
                    <span className="grow text-gray-800">{m.description}</span>
                    {applied && <span className="text-xs text-blue-700 font-medium">applied ✓</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex justify-end px-5 py-3 border-t border-gray-200">
          <Button size="sm" variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

// Shared helper: bucket tickmark applications for the grid's cellMarks
// prop (grid column keys use camelCase taxRje; the DB stores tax_rje).
export function buildCellMarks(
  applications: Array<{ id: string; accountId: string; column: string; tickmarkId: string }> | undefined,
  library: Array<Tickmark> | undefined,
): (accountId: string, column: 'unadjusted' | 'aje' | 'adjusted' | 'taxRje' | 'tax') => Array<{ id: string; symbol: string; description: string; color: string | null }> | undefined {
  const lib = new Map((library ?? []).map((t) => [t.id, t]));
  const byCell = new Map<string, Array<{ id: string; symbol: string; description: string; color: string | null }>>();
  for (const a of applications ?? []) {
    const mark = lib.get(a.tickmarkId);
    if (!mark) continue;
    const gridCol = a.column === 'tax_rje' ? 'taxRje' : a.column;
    const key = `${a.accountId}|${gridCol}`;
    const list = byCell.get(key) ?? [];
    list.push({ id: a.id, symbol: mark.symbol, description: mark.description, color: mark.color });
    byCell.set(key, list);
  }
  return (accountId, column) => byCell.get(`${accountId}|${column}`);
}
