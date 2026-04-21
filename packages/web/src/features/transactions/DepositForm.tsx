// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.


import { todayLocalISO } from '../../utils/date';
import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { JournalLine } from '@kis-books/shared';
import { useCreateTransaction, useUpdateTransaction, useTransaction } from '../../api/hooks/useTransactions';

interface DepositPayload extends Record<string, unknown> {
  txnType: 'deposit';
  txnDate: string;
  depositToAccountId: string;
  memo: string;
  lines: Array<{ accountId: string; amount: string; description: string; tagId?: string | null }>;
  draftAttachmentId?: string;
}
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DatePicker } from '../../components/forms/DatePicker';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { LineTagPicker } from '../../components/forms/SplitRowV2';
import { ENTRY_FORMS_V2 } from '../../utils/feature-flags';
import { ShortcutTooltip } from '../../components/ui/ShortcutTooltip';
import { useFormShortcuts } from '../../hooks/useFormShortcuts';
import { AttachmentPanel } from '../attachments/AttachmentPanel';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Plus, Trash2 } from 'lucide-react';

// ADR 0XX/0XY — per-line tag + stickiness flag.
interface DepositLine {
  accountId: string;
  amount: string;
  description: string;
  tagId: string | null;
  userHasTouchedTag: boolean;
}

function emptyLine(): DepositLine {
  return { accountId: '', amount: '', description: '', tagId: null, userHasTouchedTag: false };
}

export function DepositForm() {
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
  const navigate = useNavigate();
  const createTxn = useCreateTransaction();
  const updateTxn = useUpdateTransaction();
  const { data: existingData, isLoading: loadingExisting } = useTransaction(editId || '');
  const today = todayLocalISO();

  const [txnDate, setTxnDate] = useState(today);
  const [depositToAccountId, setDepositToAccountId] = useState('');
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<DepositLine[]>([emptyLine()]);
  const [draftId] = useState(() => crypto.randomUUID());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isEdit && existingData?.transaction && !loaded) {
      const txn = existingData.transaction;
      setTxnDate(txn.txnDate);
      setMemo(txn.memo || '');

      const txnLines = txn.lines || [];
      const debitLine = txnLines.find((l: JournalLine) => parseFloat(l.debit) > 0);
      const creditLines = txnLines.filter((l: JournalLine) => parseFloat(l.credit) > 0);

      if (debitLine) setDepositToAccountId(debitLine.accountId);
      if (creditLines.length > 0) {
        setLines(creditLines.map((l: JournalLine) => ({
          accountId: l.accountId,
          amount: parseFloat(l.credit).toString(),
          description: l.description || '',
          tagId: l.tagId ?? null,
          userHasTouchedTag: l.tagId != null,
        })));
      }
      setLoaded(true);
    }
  }, [isEdit, existingData, loaded]);

  const updateLine = (i: number, field: 'accountId' | 'amount' | 'description', value: string) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const updateLineTag = (i: number, tagId: string | null, touched: boolean) =>
    setLines((prev) =>
      prev.map((l, idx) =>
        idx === i ? { ...l, tagId, userHasTouchedTag: l.userHasTouchedTag || touched } : l,
      ),
    );

  const total = lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
  const mutation = isEdit ? updateTxn : createTxn;

  const { formRef, handleKeyDown, saveChord } = useFormShortcuts({
    onSave: () => formRef.current?.requestSubmit(),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload: DepositPayload = {
      txnType: 'deposit',
      txnDate,
      depositToAccountId,
      memo,
      lines: lines.filter((l) => l.accountId && l.amount).map((l) => ({
        accountId: l.accountId,
        amount: l.amount,
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isEdit ? 'Edit Deposit' : 'New Deposit'}</h1>
      <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="max-w-3xl space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <DatePicker label="Date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
          <AccountSelector label="Deposit To" value={depositToAccountId} onChange={setDepositToAccountId} accountTypeFilter="asset" required />
          <Input label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Deposit Lines</h2>
          {lines.map((line, i) => (
            <div key={i} className="flex flex-wrap gap-3 mb-2 pb-2 sm:pb-0 border-b sm:border-b-0 border-gray-100 last:border-b-0">
              <div className="w-full sm:flex-1 sm:min-w-[216px]"><AccountSelector value={line.accountId} onChange={(v) => updateLine(i, 'accountId', v)} /></div>
              <div className="w-full sm:w-44"><MoneyInput value={line.amount} onChange={(v) => updateLine(i, 'amount', v)} /></div>
              <div className="w-full sm:flex-1 sm:min-w-[160px]">
                <input value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Description" />
              </div>
              {ENTRY_FORMS_V2 && (
                <div className="w-full sm:w-40">
                  <LineTagPicker value={line.tagId} onChange={(t, touched) => updateLineTag(i, t, touched)} compact />
                </div>
              )}
              {lines.length > 1 && (
                <button type="button" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500 self-start sm:self-center">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setLines((p) => [...p, emptyLine()])}
            className="mt-2 flex items-center gap-1 text-sm text-primary-600"><Plus className="h-4 w-4" /> Add line</button>
          <p className="text-right text-sm font-medium mt-3">Total: ${total.toFixed(2)}</p>
        </div>

        {mutation.error && <p className="text-sm text-red-600">{mutation.error.message}</p>}

        <div className="flex flex-wrap gap-3">
          <ShortcutTooltip chord={saveChord}>
            <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save Changes' : 'Record Deposit'}</Button>
          </ShortcutTooltip>
          <Button type="button" variant="secondary" onClick={() => navigate(isEdit ? `/transactions/${editId}` : '/transactions')}>Cancel</Button>
        </div>

        {isEdit
          ? <AttachmentPanel attachableType="deposit" attachableId={editId!} />
          : <AttachmentPanel attachableType="draft" attachableId={draftId} />
        }
      </form>
    </div>
  );
}
