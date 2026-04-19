// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.


import { todayLocalISO } from '../../utils/date';
import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { JournalLine } from '@kis-books/shared';
import { useCreateTransaction, useUpdateTransaction, useTransaction } from '../../api/hooks/useTransactions';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DatePicker } from '../../components/forms/DatePicker';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { ContactSelector, type ContactSelection } from '../../components/forms/ContactSelector';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { TagSelector } from '../../components/forms/TagSelector';
import { LineTagPicker } from '../../components/forms/SplitRowV2';
import { AttachmentPanel } from '../attachments/AttachmentPanel';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Plus, Trash2 } from 'lucide-react';

interface ExpenseLine {
  expenseAccountId: string;
  amount: string;
  description: string;
  // ADR 0XX/0XY — per-line tag + stickiness flag (set whenever the user
  // touches the tag field directly so subsequent default recomputation
  // does not overwrite user intent).
  tagId: string | null;
  userHasTouchedTag: boolean;
}

function emptyLine(): ExpenseLine {
  return { expenseAccountId: '', amount: '', description: '', tagId: null, userHasTouchedTag: false };
}

export function ExpenseForm() {
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
  const navigate = useNavigate();
  const createTxn = useCreateTransaction();
  const updateTxn = useUpdateTransaction();
  const { data: existingData, isLoading: loadingExisting } = useTransaction(editId || '');
  const today = todayLocalISO();

  const [txnDate, setTxnDate] = useState(today);
  const [contactId, setContactId] = useState('');
  const [payFromAccountId, setPayFromAccountId] = useState('');
  const [memo, setMemo] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [lines, setLines] = useState<ExpenseLine[]>([emptyLine()]);
  const [andNew, setAndNew] = useState(false);
  const [draftId, setDraftId] = useState(() => crypto.randomUUID());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isEdit && existingData?.transaction && !loaded) {
      const txn = existingData.transaction;
      setTxnDate(txn.txnDate);
      setContactId(txn.contactId || '');
      setMemo(txn.memo || '');

      const txnLines = txn.lines || [];
      // For expenses: debit lines are expense accounts, credit line is pay-from
      const debitLines = txnLines.filter((l: JournalLine) => parseFloat(l.debit) > 0);
      const creditLine = txnLines.find((l: JournalLine) => parseFloat(l.credit) > 0);

      if (creditLine) setPayFromAccountId(creditLine.accountId);
      if (debitLines.length > 0) {
        setLines(debitLines.map((l: JournalLine) => ({
          expenseAccountId: l.accountId,
          amount: parseFloat(l.debit).toString(),
          description: l.description || '',
          tagId: l.tagId ?? null,
          // Loaded lines with a tag are treated as user-intent.
          userHasTouchedTag: l.tagId != null,
        })));
      }
      setLoaded(true);
    }
  }, [isEdit, existingData, loaded]);

  const updateLine = (index: number, field: 'expenseAccountId' | 'amount' | 'description', value: string) => {
    setLines((prev) => prev.map((line, i) => i === index ? { ...line, [field]: value } : line));
  };

  const updateLineTag = (index: number, tagId: string | null, touched: boolean) => {
    setLines((prev) =>
      prev.map((line, i) =>
        i === index ? { ...line, tagId, userHasTouchedTag: line.userHasTouchedTag || touched } : line,
      ),
    );
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const total = lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

  const handleContactSelect = (c: ContactSelection | null) => {
    if (c?.defaultExpenseAccountId && lines.length === 1 && !lines[0]!.expenseAccountId) {
      updateLine(0, 'expenseAccountId', c.defaultExpenseAccountId);
    }
  };

  const mutation = isEdit ? updateTxn : createTxn;

  // Form-scoped keyboard shortcuts. The shorter chord goes to the path
  // power users hit repeatedly — Ctrl/Cmd+Enter is "Record + New" on
  // create so back-to-back entry stays one-handed. Ctrl/Cmd+Shift+Enter
  // is the single-save path (Record Expense or, in edit mode, Save
  // Changes — where + New isn't available so plain Ctrl/Cmd+Enter also
  // saves).
  const formRef = useRef<HTMLFormElement>(null);
  const handleFormKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (!mod || e.key !== 'Enter') return;
    e.preventDefault();
    if (isEdit) {
      // Edit mode has no "+ New"; any Ctrl/Cmd+Enter just saves.
      setAndNew(false);
      formRef.current?.requestSubmit();
      return;
    }
    if (e.shiftKey) {
      // Record Expense (single save, navigate away on success).
      setAndNew(false);
    } else {
      // Record + New (save and reset for another entry).
      setAndNew(true);
    }
    formRef.current?.requestSubmit();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter((l) => l.expenseAccountId && l.amount);
    if (validLines.length === 0) return;

    interface ExpensePayloadLine {
      expenseAccountId: string;
      amount: string;
      description: string;
      tagId?: string | null;
    }
    interface ExpensePayload extends Record<string, unknown> {
      txnType: 'expense';
      txnDate: string;
      contactId?: string;
      payFromAccountId: string;
      lines: ExpensePayloadLine[];
      memo: string;
      tags: string[];
      draftAttachmentId?: string;
    }
    const payload: ExpensePayload = {
      txnType: 'expense',
      txnDate,
      contactId: contactId || undefined,
      payFromAccountId,
      // Flatten stickiness-tracking state — API only needs tagId.
      lines: validLines.map((l) => ({
        expenseAccountId: l.expenseAccountId,
        amount: l.amount,
        description: l.description,
        tagId: l.tagId,
      })),
      memo,
      tags: tagIds,
    };

    if (isEdit) {
      updateTxn.mutate({ id: editId!, ...payload }, {
        onSuccess: () => navigate(`/transactions/${editId}`),
      });
    } else {
      payload.draftAttachmentId = draftId;
      createTxn.mutate(payload, {
        onSuccess: () => {
          if (andNew) {
            setContactId('');
            setMemo('');
            setTagIds([]);
            setLines([emptyLine()]);
            setAndNew(false);
            setDraftId(crypto.randomUUID());
          } else {
            navigate('/transactions');
          }
        },
      });
    }
  };

  if (isEdit && loadingExisting) return <LoadingSpinner className="py-12" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isEdit ? 'Edit Expense' : 'New Expense'}</h1>
      <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="max-w-5xl space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DatePicker label="Date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
            <ContactSelector label="Payee (Vendor)" value={contactId} onChange={setContactId} contactTypeFilter="vendor"
              onSelect={handleContactSelect} />
          </div>
          <AccountSelector label="Pay From Account" value={payFromAccountId} onChange={setPayFromAccountId}
            accountTypeFilter={['asset', 'liability']} required />
          <Input label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
          {!isEdit && <TagSelector label="Tags" value={tagIds} onChange={setTagIds} />}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Line Items</h2>
          <table className="min-w-full table-fixed">
            <colgroup>
              <col style={{ width: '34%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '6%' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 pr-2">Category</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase pb-2 px-2">Amount</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 px-2">Description</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 px-2">Tag</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="align-top">
                  <td className="pr-2 py-1">
                    <AccountSelector value={line.expenseAccountId} onChange={(val) => updateLine(i, 'expenseAccountId', val)} accountTypeFilter="expense" required={i === 0} />
                  </td>
                  <td className="px-2 py-1">
                    <MoneyInput value={line.amount} onChange={(val) => updateLine(i, 'amount', val)} required={i === 0} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="text" value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)} placeholder="Description"
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                  </td>
                  <td className="px-2 py-1">
                    <LineTagPicker value={line.tagId} onChange={(t, touched) => updateLineTag(i, t, touched)} compact />
                  </td>
                  <td className="pl-2 py-1">
                    {lines.length > 1 && (
                      <button type="button" onClick={() => removeLine(i)} className="text-gray-400 hover:text-red-500 transition-colors pt-2">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={addLine} className="mt-3 flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 px-1 py-1">
            <Plus className="h-4 w-4" /> Add Line
          </button>
          <div className="flex justify-end mt-4 pt-3 border-t border-gray-200">
            <div className="text-right">
              <span className="text-sm text-gray-500 mr-3">Total:</span>
              <span className="text-lg font-bold font-mono text-gray-900">${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {mutation.error && <p className="text-sm text-red-600">{mutation.error.message}</p>}

        <div className="flex gap-3">
          <span className="relative group inline-block">
            <Button type="submit" loading={mutation.isPending && !andNew}>
              {isEdit ? 'Save Changes' : 'Record Expense'}
            </Button>
            <span
              role="tooltip"
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <kbd className="font-mono">Ctrl/Cmd{isEdit ? '' : '+Shift'}+Enter</kbd>
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900"
              />
            </span>
          </span>
          {!isEdit && (
            <span className="relative group inline-block">
              <Button type="button" variant="secondary" loading={createTxn.isPending && andNew}
                onClick={() => { setAndNew(true); formRef.current?.requestSubmit(); }}>
                Record + New
              </Button>
              <span
                role="tooltip"
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs font-medium text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <kbd className="font-mono">Ctrl/Cmd+Enter</kbd>
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900"
                />
              </span>
            </span>
          )}
          <Button type="button" variant="secondary" onClick={() => navigate(isEdit ? `/transactions/${editId}` : '/transactions')}>Cancel</Button>
        </div>

        <p className="text-xs text-gray-400">
          {isEdit ? (
            <>
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-500 text-[10px]">Ctrl/Cmd+Enter</kbd> save changes
            </>
          ) : (
            <>
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-500 text-[10px]">Ctrl/Cmd+Enter</kbd> record + new
              &nbsp; · &nbsp;
              <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-500 text-[10px]">Ctrl/Cmd+Shift+Enter</kbd> record expense
            </>
          )}
        </p>

        {isEdit
          ? <AttachmentPanel attachableType="expense" attachableId={editId!} />
          : <AttachmentPanel key={draftId} attachableType="draft" attachableId={draftId} />
        }
      </form>
    </div>
  );
}
