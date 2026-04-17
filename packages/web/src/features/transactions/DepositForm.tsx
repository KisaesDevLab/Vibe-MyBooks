// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCreateTransaction, useUpdateTransaction, useTransaction } from '../../api/hooks/useTransactions';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DatePicker } from '../../components/forms/DatePicker';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { TagSelector } from '../../components/forms/TagSelector';
import { AttachmentPanel } from '../attachments/AttachmentPanel';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Plus, Trash2 } from 'lucide-react';

interface DepositLine { accountId: string; amount: string; description: string }

export function DepositForm() {
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
  const navigate = useNavigate();
  const createTxn = useCreateTransaction();
  const updateTxn = useUpdateTransaction();
  const { data: existingData, isLoading: loadingExisting } = useTransaction(editId || '');
  const today = new Date().toISOString().split('T')[0]!;

  const [txnDate, setTxnDate] = useState(today);
  const [depositToAccountId, setDepositToAccountId] = useState('');
  const [memo, setMemo] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [lines, setLines] = useState<DepositLine[]>([{ accountId: '', amount: '', description: '' }]);
  const [draftId] = useState(() => crypto.randomUUID());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isEdit && existingData?.transaction && !loaded) {
      const txn = existingData.transaction;
      setTxnDate(txn.txnDate);
      setMemo(txn.memo || '');

      const txnLines = txn.lines || [];
      const debitLine = txnLines.find((l: any) => parseFloat(l.debit) > 0);
      const creditLines = txnLines.filter((l: any) => parseFloat(l.credit) > 0);

      if (debitLine) setDepositToAccountId(debitLine.accountId);
      if (creditLines.length > 0) {
        setLines(creditLines.map((l: any) => ({
          accountId: l.accountId,
          amount: parseFloat(l.credit).toString(),
          description: l.description || '',
        })));
      }
      setLoaded(true);
    }
  }, [isEdit, existingData, loaded]);

  const updateLine = (i: number, field: keyof DepositLine, value: string) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const total = lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
  const mutation = isEdit ? updateTxn : createTxn;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload: any = {
      txnType: 'deposit',
      txnDate,
      depositToAccountId,
      memo,
      lines: lines.filter((l) => l.accountId && l.amount),
      tags: tagIds,
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
      <form onSubmit={handleSubmit} className="max-w-3xl space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <DatePicker label="Date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
          <AccountSelector label="Deposit To" value={depositToAccountId} onChange={setDepositToAccountId} accountTypeFilter="asset" required />
          <Input label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
          {!isEdit && <TagSelector label="Tags" value={tagIds} onChange={setTagIds} />}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Deposit Lines</h2>
          {lines.map((line, i) => (
            <div key={i} className="flex gap-3 mb-2">
              <div className="flex-1"><AccountSelector value={line.accountId} onChange={(v) => updateLine(i, 'accountId', v)} /></div>
              <div className="w-32"><MoneyInput value={line.amount} onChange={(v) => updateLine(i, 'amount', v)} /></div>
              <div className="flex-1">
                <input value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Description" />
              </div>
              {lines.length > 1 && (
                <button type="button" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={() => setLines((p) => [...p, { accountId: '', amount: '', description: '' }])}
            className="mt-2 flex items-center gap-1 text-sm text-primary-600"><Plus className="h-4 w-4" /> Add line</button>
          <p className="text-right text-sm font-medium mt-3">Total: ${total.toFixed(2)}</p>
        </div>

        {mutation.error && <p className="text-sm text-red-600">{mutation.error.message}</p>}

        <div className="flex gap-3">
          <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save Changes' : 'Record Deposit'}</Button>
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
