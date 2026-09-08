// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Copy tax-code mappings from one activity unit (or the account-level
// codes = the default unit) onto other live units — unit mapping mode.
// A dry run previews per-target counts as the selection changes; codes
// that don't fit a target's activity are skipped and listed, never
// silently written.

import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toaster';
import { isApiError } from '../../api/client';
import {
  useCopyAssignments, useCopyAssignmentsPreview,
  type TbActivityUnit, type TbCopyAssignmentsInput,
} from '../../api/hooks/useTb';

const ACTIVITY_LABELS: Record<string, string> = {
  business: 'Business', rental: 'Rental', farm: 'Farm', farm_rental: 'Farm rental',
};
const REASON_LABELS: Record<string, string> = {
  incompatible_activity: 'wrong activity',
  missing_from_seed: 'code not in the current seed',
  inactive_firm_code: 'inactive custom code',
  existing: 'already coded',
};

export function TbCopyMappingsDialog({ units, accountNames, onClose, onCopied }: {
  units: TbActivityUnit[];
  accountNames: Map<string, string>;
  onClose: () => void;
  onCopied: () => void;
}) {
  const toast = useToast();
  const copy = useCopyAssignments();
  const live = units.filter((u) => !u.archivedAt);
  const defaultUnit = live.find((u) => u.isDefault) ?? null;
  // Source: the account-level codes ('') or any unit (archived allowed —
  // copying off a retired unit is a legitimate migration).
  const [source, setSource] = useState<string>('');
  const [targets, setTargets] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<'skip_existing' | 'overwrite'>('skip_existing');

  const targetChoices = live.filter((u) => !u.isDefault && u.id !== source);
  useEffect(() => {
    setTargets((prev) => new Set([...prev].filter((id) => targetChoices.some((u) => u.id === id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  const input = useMemo<TbCopyAssignmentsInput | null>(() => targets.size === 0 ? null : ({
    sourceUnitId: source || null,
    targetUnitIds: [...targets],
    mode,
  }), [source, targets, mode]);
  const preview = useCopyAssignmentsPreview(input);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const unitLabel = (u: TbActivityUnit) => `${ACTIVITY_LABELS[u.activityType] ?? u.activityType} #${u.instanceNumber} — ${u.displayName}`;

  const run = () => {
    if (!input) return;
    copy.mutate(input, {
      onSuccess: (res) => {
        toast.success(`Copied ${res.copied} mapping${res.copied === 1 ? '' : 's'}`
          + (res.skippedExisting ? ` · ${res.skippedExisting} already coded` : '')
          + (res.skippedIncompatible ? ` · ${res.skippedIncompatible} incompatible skipped` : ''));
        onCopied();
        onClose();
      },
      onError: (e) => toast.error(isApiError(e) ? e.message : 'Copy failed'),
    });
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Copy tax code mappings" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Copy tax code mappings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">✕</button>
        </div>
        <div className="p-5 overflow-y-auto grow space-y-4">
          <p className="text-sm text-gray-600">
            Reuse one activity&apos;s codes on another — e.g. a second Schedule F farm. Only codes valid for the target&apos;s
            activity are copied (common lines like DONOTMAP always are); the rest are listed below and left alone.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="copy-source">Copy from</label>
            <select id="copy-source" value={source} onChange={(e) => setSource(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-full">
              <option value="">Account-level codes{defaultUnit ? ` (default unit: ${defaultUnit.displayName})` : ''}</option>
              {units.filter((u) => !u.isDefault).map((u) => (
                <option key={u.id} value={u.id}>{unitLabel(u)}{u.archivedAt ? ' (archived)' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Copy to</p>
            {targetChoices.length === 0 ? (
              <p className="text-xs text-gray-500">No other live units. The default unit always uses the account-level codes, so it is never a target.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {targetChoices.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 text-sm rounded border border-gray-200 px-2 py-1.5 cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={targets.has(u.id)}
                      onChange={(e) => setTargets((prev) => { const n = new Set(prev); if (e.target.checked) n.add(u.id); else n.delete(u.id); return n; })} />
                    {unitLabel(u)}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5"><input type="radio" checked={mode === 'skip_existing'} onChange={() => setMode('skip_existing')} /> Keep existing codes on the target</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={mode === 'overwrite'} onChange={() => setMode('overwrite')} /> Overwrite existing codes</label>
          </div>

          {input && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              {preview.isLoading || preview.isFetching ? (
                <div className="flex items-center gap-2 text-gray-500"><LoadingSpinner size="sm" /> Previewing…</div>
              ) : preview.isError ? (
                <p className="text-red-700">{isApiError(preview.error) ? preview.error.message : 'Preview failed'}</p>
              ) : preview.data ? (
                <div className="space-y-2">
                  <p className="font-medium text-gray-800">
                    Will copy {preview.data.copied}
                    {preview.data.skippedExisting ? ` · skip ${preview.data.skippedExisting} already coded` : ''}
                    {preview.data.skippedIncompatible ? ` · skip ${preview.data.skippedIncompatible} incompatible` : ''}
                  </p>
                  {preview.data.perTarget.map((t) => (
                    <div key={t.unitId} className="text-xs text-gray-700">
                      <span className="font-medium">{t.displayName}</span>: {t.copied} to copy{t.overwritten ? ` (${t.overwritten} overwritten)` : ''}
                      {t.skippedExisting ? `, ${t.skippedExisting} kept` : ''}
                      {t.incompatible.length > 0 && (
                        <ul className="ml-4 list-disc text-gray-500">
                          {t.incompatible.slice(0, 8).map((i) => (
                            <li key={`${i.accountId}-${i.code}`}>{accountNames.get(i.accountId) ?? i.accountId} — {i.code} ({REASON_LABELS[i.reason] ?? i.reason})</li>
                          ))}
                          {t.incompatible.length > 8 && <li>…and {t.incompatible.length - 8} more</li>}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} disabled={copy.isPending}>Cancel</Button>
          <Button onClick={run} disabled={!input || !preview.data || preview.data.copied === 0 || copy.isPending} loading={copy.isPending}>
            Copy {preview.data?.copied ?? 0} mapping{(preview.data?.copied ?? 0) === 1 ? '' : 's'}
          </Button>
        </div>
      </div>
    </div>
  );
}
