// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.


import { todayLocalISO } from '../../utils/date';
import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { JournalLine, JournalLineInput } from '@kis-books/shared';
import { useCreateTransaction, useUpdateTransaction, useTransaction } from '../../api/hooks/useTransactions';

interface JournalEntryPayload extends Record<string, unknown> {
  txnType: 'journal_entry';
  txnDate: string;
  memo: string;
  lines: JournalLineInput[];
  draftAttachmentId?: string;
}
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DatePicker } from '../../components/forms/DatePicker';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { SplitRowV2, LineTagPicker } from '../../components/forms/SplitRowV2';
import { ShortcutTooltip } from '../../components/ui/ShortcutTooltip';
import { useFormShortcuts } from '../../hooks/useFormShortcuts';
import { ENTRY_FORMS_V2 } from '../../utils/feature-flags';
import { AttachmentPanel } from '../attachments/AttachmentPanel';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Plus, Trash2 } from 'lucide-react';

// `tagId` + `userHasTouchedTag` land with ADR 0XY/0XZ. The stickiness flag
// is false on newly-created lines so default-tag recomputation is free to
// fill them in; it flips true the first time the user interacts with the
// tag field on the row (see LineTagPicker).
interface Line {
  accountId: string;
  description: string;
  debit: string;
  credit: string;
  tagId: string | null;
  userHasTouchedTag: boolean;
}

function emptyLine(): Line {
  return { accountId: '', description: '', debit: '', credit: '', tagId: null, userHasTouchedTag: false };
}

export function JournalEntryForm() {
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
  const navigate = useNavigate();
  const createTxn = useCreateTransaction();
  const updateTxn = useUpdateTransaction();
  const { data: existingData, isLoading: loadingExisting } = useTransaction(editId || '');
  const today = todayLocalISO();

  const [txnDate, setTxnDate] = useState(today);
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [draftId] = useState(() => crypto.randomUUID());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isEdit && existingData?.transaction && !loaded) {
      const txn = existingData.transaction;
      setTxnDate(txn.txnDate);
      setMemo(txn.memo || '');

      const txnLines = txn.lines || [];
      if (txnLines.length > 0) {
        setLines(txnLines.map((l: JournalLine) => ({
          accountId: l.accountId,
          description: l.description || '',
          debit: parseFloat(l.debit) > 0 ? parseFloat(l.debit).toString() : '',
          credit: parseFloat(l.credit) > 0 ? parseFloat(l.credit).toString() : '',
          tagId: l.tagId ?? null,
          // Loaded lines with a tag are treated as user-intent so future
          // defaults (e.g., after changing Item) don't overwrite them.
          userHasTouchedTag: l.tagId != null,
        })));
      }
      setLoaded(true);
    }
  }, [isEdit, existingData, loaded]);

  const updateLine = (index: number, field: keyof Line, value: string) => {
    setLines((prev) => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };

  const updateLineTag = (index: number, tagId: string | null, touched: boolean) => {
    setLines((prev) =>
      prev.map((l, i) =>
        i === index ? { ...l, tagId, userHasTouchedTag: l.userHasTouchedTag || touched } : l,
      ),
    );
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index));

  const totalDebits = lines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
  const totalCredits = lines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const difference = totalDebits - totalCredits;
  const isBalanced = Math.abs(difference) < 0.01 && totalDebits > 0;
  const mutation = isEdit ? updateTxn : createTxn;

  const { formRef, handleKeyDown, saveChord } = useFormShortcuts({
    onSave: () => formRef.current?.requestSubmit(),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isBalanced) return;

    const payload: JournalEntryPayload = {
      txnType: 'journal_entry',
      txnDate,
      memo,
      lines: lines.filter((l) => l.accountId).map((l) => ({
        accountId: l.accountId,
        debit: l.debit || '0',
        credit: l.credit || '0',
        description: l.description,
        tagId: l.tagId,
      })),
    };

    if (isEdit) {
      updateTxn.mutate({ id: editId!, ...payload }, { onSuccess: () => navigate(`/transactions/${editId}`) });
    } else {
      payload.draftAttachmentId = draftId;
      createTxn.mutate(payload, { onSuccess: () => navigate('/transactions') });
    }
  };

  if (isEdit && loadingExisting) return <LoadingSpinner className="py-12" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isEdit ? 'Edit Journal Entry' : 'New Journal Entry'}</h1>
      <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="max-w-4xl space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <DatePicker label="Date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
            <Input label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          {ENTRY_FORMS_V2 ? (
            <div className="space-y-2">
              {lines.map((line, i) => (
                <SplitRowV2
                  key={i}
                  index={i}
                  total={lines.length}
                  isFirst={i === 0}
                  onDelete={lines.length > 2 ? () => removeLine(i) : undefined}
                  onDuplicate={() => setLines((prev) => {
                    const src = prev[i];
                    if (!src) return prev;
                    // Clone including tag + stickiness flag per ADR 0XY §4.4.
                    return [...prev.slice(0, i + 1), { ...src }, ...prev.slice(i + 1)];
                  })}
                  onAddRow={i === lines.length - 1 ? addLine : undefined}
                  onApplyTagToAll={i === 0 && line.tagId ? () => {
                    // Copy the first row's tag to every row below that
                    // has not been touched (ADR 0XY §4.3).
                    setLines((prev) => prev.map((l, idx) =>
                      idx === 0 || l.userHasTouchedTag ? l : { ...l, tagId: line.tagId },
                    ));
                  } : undefined}
                  line1={
                    <>
                      <div className="flex-1 min-w-0">
                        <AccountSelector value={line.accountId} onChange={(v) => updateLine(i, 'accountId', v)} />
                      </div>
                      <div className="w-32">
                        <MoneyInput value={line.debit} onChange={(v) => updateLine(i, 'debit', v)} />
                      </div>
                      <div className="w-32">
                        <MoneyInput value={line.credit} onChange={(v) => updateLine(i, 'credit', v)} />
                      </div>
                    </>
                  }
                  line2={
                    <>
                      <input
                        value={line.description}
                        onChange={(e) => updateLine(i, 'description', e.target.value)}
                        className="flex-1 min-w-0 rounded border border-gray-300 px-3 py-1.5 text-sm"
                        placeholder="Description"
                      />
                      <div className="w-44">
                        <LineTagPicker
                          value={line.tagId}
                          onChange={(tagId, touched) => updateLineTag(i, tagId, touched)}
                          compact
                        />
                      </div>
                    </>
                  }
                />
              ))}
            </div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 w-1/3">Account</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2">Description</th>
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
                    <td className="px-2 py-1"><MoneyInput value={line.debit} onChange={(v) => updateLine(i, 'debit', v)} /></td>
                    <td className="px-2 py-1"><MoneyInput value={line.credit} onChange={(v) => updateLine(i, 'credit', v)} /></td>
                    <td className="pl-2 py-1">
                      {lines.length > 2 && (
                        <button type="button" onClick={() => removeLine(i)} className="text-gray-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button type="button" onClick={addLine} className="mt-3 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700">
            <Plus className="h-4 w-4" /> Add line
          </button>
          <div className="flex justify-end mt-4 border-t pt-4 text-sm">
            <div className="space-y-1 text-right">
              <p>Total Debits: <span className="font-mono font-medium">${totalDebits.toFixed(2)}</span></p>
              <p>Total Credits: <span className="font-mono font-medium">${totalCredits.toFixed(2)}</span></p>
              <p className={difference === 0 && totalDebits > 0 ? 'text-green-600' : 'text-red-600'}>
                Difference: <span className="font-mono font-medium">${Math.abs(difference).toFixed(2)}</span>
              </p>
            </div>
          </div>
        </div>

        {mutation.error && <p className="text-sm text-red-600">{mutation.error.message}</p>}

        <div className="flex gap-3">
          <ShortcutTooltip chord={saveChord}>
            <Button type="submit" disabled={!isBalanced} loading={mutation.isPending}>{isEdit ? 'Save Changes' : 'Post Journal Entry'}</Button>
          </ShortcutTooltip>
          <Button type="button" variant="secondary" onClick={() => navigate(isEdit ? `/transactions/${editId}` : '/transactions')}>Cancel</Button>
        </div>

        {isEdit
          ? <AttachmentPanel attachableType="journal_entry" attachableId={editId!} />
          : <AttachmentPanel attachableType="draft" attachableId={draftId} />
        }
      </form>
    </div>
  );
}
