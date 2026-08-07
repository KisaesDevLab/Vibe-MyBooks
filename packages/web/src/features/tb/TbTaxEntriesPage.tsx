// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tax RJE register + editor (Phase 8, ADR-TB-03). These entries are
// tax-basis-only: they appear in the TB tax columns, M-1/M-2, and
// exports — never in the GL, financial reports, or the client portal.

import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, isApiError } from '../../api/client';
import { useActivityUnits, useTbProfile } from '../../api/hooks/useTb';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toaster';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { AttachmentPanel } from '../attachments/AttachmentPanel';
import { activeCompanyId, publishTbChange } from './workpaperShared';
import { Plus, Trash2 } from 'lucide-react';

interface RjeLine {
  id?: string;
  accountId: string;
  activityUnitId: string | null;
  debit: string;
  credit: string;
  description: string | null;
}

interface Rje {
  id: string;
  taxYear: number;
  entryNumber: number;
  entryNumberLabel: string;
  memo: string | null;
  isM1: boolean;
  lines: RjeLine[];
}

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

export function TbTaxEntriesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: profileData } = useTbProfile();
  const [taxYear, setTaxYear] = useState<number | null>(null);
  const effYear = taxYear ?? profileData?.fiscal.currentTaxYear ?? new Date().getFullYear();
  const [editing, setEditing] = useState<Rje | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Rje | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['tb', 'tax-entries', effYear],
    queryFn: () => apiClient<{ entries: Rje[] }>(`/tb/tax-entries?taxYear=${effYear}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient(`/tb/tax-entries/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tb'] });
      publishTbChange(activeCompanyId());
      toast.success('Tax entry deleted');
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'Delete failed'),
  });

  const total = (e: Rje) => e.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Tax Adjustments (RJEs)</h1>
          <p className="text-sm text-gray-500">Tax-basis-only entries — they shape the Tax columns and Schedule M-1, and never touch the books.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-700" htmlFor="rje-year">Tax year</label>
          <input id="rje-year" type="number" value={effYear}
            onChange={(e) => setTaxYear(Number(e.target.value))}
            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <Button onClick={() => setEditing('new')}>New tax entry</Button>
        </div>
      </div>

      {isLoading && <LoadingSpinner className="py-12" />}
      {data && data.entries.length === 0 && (
        <p className="text-sm text-gray-500 py-8">No tax adjustments for TY{effYear}.</p>
      )}
      {data && data.entries.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Memo</th>
                <th className="px-4 py-2">Lines</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">M-1</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs text-purple-700 font-medium">{e.entryNumberLabel}</td>
                  <td className="px-4 py-2 max-w-md truncate">{e.memo || '—'}</td>
                  <td className="px-4 py-2 text-xs text-gray-500">{e.lines.length}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{usd(total(e))}</td>
                  <td className="px-4 py-2">
                    {e.isM1 && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">M-1</span>}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button className="text-xs text-gray-500 hover:text-blue-600 underline mr-3"
                      onClick={() => setEditing(e)}>edit</button>
                    <button className="text-xs text-gray-500 hover:text-red-600 underline"
                      onClick={() => setDeleteTarget(e)}>delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <RjeFormModal
          taxYear={effYear}
          entry={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete ${deleteTarget?.entryNumberLabel ?? 'tax entry'}?`}
        message="Tax entries never touched the books, so deletion removes them entirely (the change is audit-logged)."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) remove.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function RjeFormModal({ taxYear, entry, onClose }: { taxYear: number; entry: Rje | null; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: unitsData } = useActivityUnits();
  const [memo, setMemo] = useState(entry?.memo ?? '');
  const [lines, setLines] = useState<RjeLine[]>(entry?.lines.map((l) => ({
    ...l,
    debit: parseFloat(l.debit) > 0 ? String(parseFloat(l.debit)) : '',
    credit: parseFloat(l.credit) > 0 ? String(parseFloat(l.credit)) : '',
  })) ?? [
    { accountId: '', activityUnitId: null, debit: '', credit: '', description: '' },
    { accountId: '', activityUnitId: null, debit: '', credit: '', description: '' },
  ]);
  const [draftId] = useState(() => crypto.randomUUID());

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      entry
        ? apiClient(`/tb/tax-entries/${entry.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        : apiClient('/tb/tax-entries', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tb'] });
      publishTbChange(activeCompanyId());
      toast.success(entry ? 'Tax entry saved' : 'Tax entry posted');
      onClose();
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'Save failed'),
  });

  const updateLine = (i: number, patch: Partial<RjeLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const totalDebits = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredits = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebits - totalCredits) < 0.005 && totalDebits > 0;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!balanced) return;
    save.mutate({
      taxYear,
      memo,
      lines: lines.filter((l) => l.accountId).map((l) => ({
        accountId: l.accountId,
        activityUnitId: l.activityUnitId,
        debit: l.debit || '0',
        credit: l.credit || '0',
        description: l.description || undefined,
      })),
      ...(entry ? {} : { draftAttachmentId: draftId }),
    });
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <form onSubmit={submit} className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            {entry ? `Edit ${entry.entryNumberLabel}` : 'New tax adjustment'}
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">TY{taxYear} · tax basis only</span>
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Memo (e.g. Section 179 expense)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs uppercase text-gray-500">
                <th className="pb-1 w-1/3">Account</th>
                <th className="pb-1">Activity unit</th>
                <th className="pb-1 text-right w-28">Debit</th>
                <th className="pb-1 text-right w-28">Credit</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="pr-2 py-1"><AccountSelector value={l.accountId} onChange={(v) => updateLine(i, { accountId: v })} /></td>
                  <td className="pr-2 py-1">
                    <select value={l.activityUnitId ?? ''} aria-label="Activity unit"
                      onChange={(e) => updateLine(i, { activityUnitId: e.target.value || null })}
                      className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm">
                      <option value="">Account level</option>
                      {(unitsData?.units ?? []).map((u) => <option key={u.id} value={u.id}>{u.displayName}</option>)}
                    </select>
                  </td>
                  <td className="pr-2 py-1"><MoneyInput value={l.debit} onChange={(v) => updateLine(i, { debit: v })} /></td>
                  <td className="pr-2 py-1"><MoneyInput value={l.credit} onChange={(v) => updateLine(i, { credit: v })} /></td>
                  <td className="py-1">
                    {lines.length > 2 && (
                      <button type="button" aria-label="Remove line" className="text-gray-400 hover:text-red-500"
                        onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
            onClick={() => setLines((prev) => [...prev, { accountId: '', activityUnitId: null, debit: '', credit: '', description: '' }])}>
            <Plus className="h-4 w-4" /> Add line
          </button>
          <div className="text-right text-sm space-y-0.5">
            <p>Debits <span className="font-mono">{usd(totalDebits)}</span> · Credits <span className="font-mono">{usd(totalCredits)}</span></p>
            {!balanced && totalDebits + totalCredits > 0 && (
              <p className="text-red-600 text-xs">Entry must net to zero.</p>
            )}
          </div>
          {entry
            ? <AttachmentPanel attachableType="tb_tax_entry" attachableId={entry.id} />
            : <AttachmentPanel attachableType="draft" attachableId={draftId} />}
        </div>
        <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-200">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!balanced} loading={save.isPending}>{entry ? 'Save' : 'Post tax entry'}</Button>
        </div>
      </form>
    </div>
  );
}
