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

export function TransferForm() {
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
  const navigate = useNavigate();
  const createTxn = useCreateTransaction();
  const updateTxn = useUpdateTransaction();
  const { data: existingData, isLoading: loadingExisting } = useTransaction(editId || '');
  const today = new Date().toISOString().split('T')[0]!;

  const [txnDate, setTxnDate] = useState(today);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [draftId] = useState(() => crypto.randomUUID());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isEdit && existingData?.transaction && !loaded) {
      const txn = existingData.transaction;
      setTxnDate(txn.txnDate);
      setMemo(txn.memo || '');

      const txnLines = txn.lines || [];
      const debitLine = txnLines.find((l: any) => parseFloat(l.debit) > 0);
      const creditLine = txnLines.find((l: any) => parseFloat(l.credit) > 0);

      if (debitLine) { setToAccountId(debitLine.accountId); setAmount(parseFloat(debitLine.debit).toString()); }
      if (creditLine) setFromAccountId(creditLine.accountId);
      setLoaded(true);
    }
  }, [isEdit, existingData, loaded]);

  const mutation = isEdit ? updateTxn : createTxn;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload: any = { txnType: 'transfer', txnDate, fromAccountId, toAccountId, amount, memo, tags: tagIds };

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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isEdit ? 'Edit Transfer' : 'New Transfer'}</h1>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <DatePicker label="Date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
          <AccountSelector label="From Account" value={fromAccountId} onChange={setFromAccountId} accountTypeFilter={['asset', 'liability']} required />
          <AccountSelector label="To Account" value={toAccountId} onChange={setToAccountId} accountTypeFilter={['asset', 'liability']} required />
          <MoneyInput label="Amount" value={amount} onChange={setAmount} required />
          <Input label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
          {!isEdit && <TagSelector label="Tags" value={tagIds} onChange={setTagIds} />}
        </div>

        {mutation.error && <p className="text-sm text-red-600">{mutation.error.message}</p>}

        <div className="flex gap-3">
          <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save Changes' : 'Record Transfer'}</Button>
          <Button type="button" variant="secondary" onClick={() => navigate(isEdit ? `/transactions/${editId}` : '/transactions')}>Cancel</Button>
        </div>

        {isEdit
          ? <AttachmentPanel attachableType="transfer" attachableId={editId!} />
          : <AttachmentPanel attachableType="draft" attachableId={draftId} />
        }
      </form>
    </div>
  );
}
