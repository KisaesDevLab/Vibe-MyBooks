// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// AJE entry form (Phase 5.2) — multi-line DR/CR with per-line activity
// tags and attachments, posting through the firm-only /tb/ajes
// endpoints (numbering + closing-date exemption live server-side).
// Mirrors JournalEntryForm's classic layout; deliberately separate so
// the shared JE form stays untouched (AJEs are TB-module territory).

import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { todayLocalISO } from '../../utils/date';
import { apiClient, isApiError } from '../../api/client';
import { useTransaction } from '../../api/hooks/useTransactions';
import type { JournalLine } from '@kis-books/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DatePicker } from '../../components/forms/DatePicker';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { LineTagPicker } from '../../components/forms/SplitRowV2';
import { AttachmentPanel } from '../attachments/AttachmentPanel';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Plus, Trash2 } from 'lucide-react';

type Basis = 'cash' | 'accrual' | 'both';

interface Line {
  accountId: string;
  description: string;
  debit: string;
  credit: string;
  tagId: string | null;
}

const emptyLine = (): Line => ({ accountId: '', description: '', debit: '', credit: '', tagId: null });

export function AjeFormPage() {
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: existingData, isLoading: loadingExisting } = useTransaction(editId || '');

  const [txnDate, setTxnDate] = useState(todayLocalISO());
  const [memo, setMemo] = useState('');
  const [basis, setBasis] = useState<Basis>('both');
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [draftId] = useState(() => crypto.randomUUID());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isEdit && existingData?.transaction && !loaded) {
      const txn = existingData.transaction;
      setTxnDate(txn.txnDate);
      setMemo(txn.memo || '');
      setBasis((txn.basis as Basis) || 'both');
      const txnLines = (txn.lines || []) as JournalLine[];
      if (txnLines.length > 0) {
        setLines(txnLines.map((l) => ({
          accountId: l.accountId,
          description: l.description || '',
          debit: parseFloat(l.debit) > 0 ? parseFloat(l.debit).toString() : '',
          credit: parseFloat(l.credit) > 0 ? parseFloat(l.credit).toString() : '',
          tagId: l.tagId ?? null,
        })));
      }
      setLoaded(true);
    }
  }, [isEdit, existingData, loaded]);

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      isEdit
        ? apiClient<{ aje: { id: string } }>(`/tb/ajes/${editId}`, { method: 'PUT', body: JSON.stringify(payload) })
        : apiClient<{ aje: { id: string } }>('/tb/ajes', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['tb'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      navigate(`/transactions/${res.aje.id}`);
    },
  });

  const updateLine = (index: number, field: keyof Line, value: string | null) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  };
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  const totalDebits = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const difference = totalDebits - totalCredits;
  const isBalanced = Math.abs(difference) < 0.01 && totalDebits > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isBalanced) return;
    const payload: Record<string, unknown> = {
      txnDate,
      memo,
      basis,
      lines: lines.filter((l) => l.accountId).map((l) => ({
        accountId: l.accountId,
        debit: l.debit || '0',
        credit: l.credit || '0',
        description: l.description,
        tagId: l.tagId,
      })),
    };
    if (!isEdit) payload['draftAttachmentId'] = draftId;
    mutation.mutate(payload);
  };

  if (isEdit && loadingExisting) return <LoadingSpinner className="py-12" />;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {isEdit ? 'Edit Adjusting Entry' : 'New Adjusting Entry'}
          <span className="ml-3 align-middle text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Book AJE</span>
        </h1>
        <p className="text-sm text-gray-500">
          Posts to the general ledger as a firm adjusting entry, numbered per fiscal year. Clients see it read-only in reports.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DatePicker label="Date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
            <Input label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 w-1/3">Account</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2">Description</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 w-44">Activity tag</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase pb-2 w-32">Debit</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase pb-2 w-32">Credit</th>
                <th className="w-10 pb-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td className="pr-2 py-1"><AccountSelector value={line.accountId} onChange={(v) => updateLine(i, 'accountId', v)} /></td>
                  <td className="px-2 py-1">
                    <input value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Description" />
                  </td>
                  <td className="px-2 py-1">
                    <LineTagPicker value={line.tagId} onChange={(tagId) => updateLine(i, 'tagId', tagId)} compact />
                  </td>
                  <td className="px-2 py-1"><MoneyInput value={line.debit} onChange={(v) => updateLine(i, 'debit', v)} /></td>
                  <td className="px-2 py-1"><MoneyInput value={line.credit} onChange={(v) => updateLine(i, 'credit', v)} /></td>
                  <td className="pl-2 py-1">
                    {lines.length > 2 && (
                      <button type="button" onClick={() => removeLine(i)} aria-label="Remove line"
                        className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={addLine} className="mt-3 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
            <Plus className="h-4 w-4" /> Add line
          </button>
          <div className="flex flex-wrap justify-between items-end gap-4 mt-4 border-t pt-4 text-sm">
            <div>
              <label htmlFor="aje-basis" className="block text-xs font-medium text-gray-500 uppercase mb-1">Basis</label>
              <select id="aje-basis" value={basis} onChange={(e) => setBasis(e.target.value as Basis)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="both">Both (cash &amp; accrual)</option>
                <option value="accrual">Accrual only</option>
                <option value="cash">Cash only</option>
              </select>
              <p className="text-xs text-gray-400 mt-1 max-w-xs">
                “Accrual only” keeps this adjustment (e.g. depreciation) off cash-basis reports.
              </p>
            </div>
            <div className="space-y-1 text-right">
              <p>Total Debits: <span className="font-mono font-medium">${totalDebits.toFixed(2)}</span></p>
              <p>Total Credits: <span className="font-mono font-medium">${totalCredits.toFixed(2)}</span></p>
              <p className={difference === 0 && totalDebits > 0 ? 'text-green-600' : 'text-red-600'}>
                Difference: <span className="font-mono font-medium">${Math.abs(difference).toFixed(2)}</span>
              </p>
            </div>
          </div>
        </div>

        {mutation.error && (
          <p className="text-sm text-red-600">{isApiError(mutation.error) ? mutation.error.message : 'Save failed'}</p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={!isBalanced} loading={mutation.isPending}>
            {isEdit ? 'Save Changes' : 'Post AJE'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/tb/ajes')}>Cancel</Button>
        </div>

        {isEdit
          ? <AttachmentPanel attachableType="journal_entry" attachableId={editId!} />
          : <AttachmentPanel attachableType="draft" attachableId={draftId} />
        }
      </form>
    </div>
  );
}
