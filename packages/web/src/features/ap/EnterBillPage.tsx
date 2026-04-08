import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCreateBill, useUpdateBill } from '../../api/hooks/useAp';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DatePicker } from '../../components/forms/DatePicker';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { ContactSelector } from '../../components/forms/ContactSelector';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Plus, Trash2 } from 'lucide-react';

interface BillLine {
  accountId: string;
  description: string;
  amount: string;
}

const TERM_DAYS: Record<string, number> = {
  due_on_receipt: 0,
  net_10: 10,
  net_15: 15,
  net_30: 30,
  net_45: 45,
  net_60: 60,
  net_90: 90,
};

function emptyLine(): BillLine {
  return { accountId: '', description: '', amount: '' };
}

function calcDueDate(billDate: string, terms: string, customDays: string): string {
  if (!billDate) return '';
  const d = new Date(billDate);
  let days: number | undefined;
  if (terms === 'custom') {
    days = parseInt(customDays || '0', 10);
  } else if (terms in TERM_DAYS) {
    days = TERM_DAYS[terms];
  }
  if (days === undefined || isNaN(days)) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0]!;
}

export function EnterBillPage() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
  const today = new Date().toISOString().split('T')[0]!;

  const createBill = useCreateBill();
  const updateBill = useUpdateBill();

  const [contactId, setContactId] = useState('');
  const [txnDate, setTxnDate] = useState(today);
  const [dueDate, setDueDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('net_30');
  const [customDays, setCustomDays] = useState('');
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
  const [memo, setMemo] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [dueDateManual, setDueDateManual] = useState(false);
  const [lines, setLines] = useState<BillLine[]>([emptyLine()]);
  const [loaded, setLoaded] = useState(!isEdit);
  const [andNew, setAndNew] = useState(false);

  // Edit-mode load
  const { data: existingData } = useQuery({
    queryKey: ['bills', editId],
    queryFn: () => apiClient<{ bill: any }>(`/bills/${editId}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!existingData?.bill) return;
    const b = existingData.bill;
    setContactId(b.contactId || '');
    setTxnDate(b.txnDate || today);
    setDueDate(b.dueDate || '');
    setPaymentTerms(b.paymentTerms || 'net_30');
    setCustomDays(b.termsDays ? String(b.termsDays) : '');
    setVendorInvoiceNumber(b.vendorInvoiceNumber || '');
    setMemo(b.memo || '');
    setInternalNotes(b.internalNotes || '');
    setDueDateManual(true);

    const billLines: BillLine[] = (b.lines || [])
      .filter((l: any) => parseFloat(l.debit) > 0 && l.accountId)
      .map((l: any) => ({
        accountId: l.accountId,
        description: l.description || '',
        amount: parseFloat(l.debit).toFixed(2),
      }));
    if (billLines.length > 0) setLines(billLines);
    setLoaded(true);
  }, [existingData, today]);

  // Auto-recalc due date when terms or txn date change (unless user manually edited)
  useEffect(() => {
    if (!isEdit && !dueDateManual && txnDate) {
      setDueDate(calcDueDate(txnDate, paymentTerms, customDays));
    }
  }, [txnDate, paymentTerms, customDays, isEdit, dueDateManual]);

  const updateLine = (i: number, field: keyof BillLine, value: string) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));

  const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);

  const buildPayload = () => ({
    contactId,
    txnDate,
    dueDate: dueDate || undefined,
    paymentTerms,
    termsDays: paymentTerms === 'custom' && customDays ? parseInt(customDays, 10) : undefined,
    vendorInvoiceNumber: vendorInvoiceNumber || undefined,
    memo: memo || undefined,
    internalNotes: internalNotes || undefined,
    lines: lines
      .filter((l) => l.accountId && l.amount && parseFloat(l.amount) > 0)
      .map((l) => ({
        accountId: l.accountId,
        description: l.description || undefined,
        amount: l.amount,
      })),
  });

  const resetForNew = () => {
    setContactId('');
    setVendorInvoiceNumber('');
    setMemo('');
    setInternalNotes('');
    setLines([emptyLine()]);
    setDueDateManual(false);
    setAndNew(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    if (payload.lines.length === 0) return;

    if (isEdit) {
      updateBill.mutate({ id: editId!, input: payload }, {
        onSuccess: () => navigate(`/bills/${editId}`),
      });
    } else {
      createBill.mutate(payload, {
        onSuccess: (data) => {
          if (andNew) resetForNew();
          else navigate(`/bills/${data.bill.id}`);
        },
      });
    }
  };

  const error = isEdit ? updateBill.error : createBill.error;
  const isPending = isEdit ? updateBill.isPending : createBill.isPending;

  if (!loaded) return <LoadingSpinner className="py-12" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isEdit ? 'Edit Bill' : 'Enter Bill'}</h1>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <ContactSelector
            label="Vendor"
            value={contactId}
            onChange={setContactId}
            contactTypeFilter="vendor"
            required
          />
          <div className="grid grid-cols-3 gap-4">
            <DatePicker label="Bill Date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
            <DatePicker
              label="Due Date"
              value={dueDate}
              onChange={(e) => { setDueDate(e.target.value); setDueDateManual(true); }}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
              <select
                value={paymentTerms}
                onChange={(e) => { setPaymentTerms(e.target.value); setDueDateManual(false); }}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="due_on_receipt">Due On Receipt</option>
                <option value="net_10">Net 10</option>
                <option value="net_15">Net 15</option>
                <option value="net_30">Net 30</option>
                <option value="net_45">Net 45</option>
                <option value="net_60">Net 60</option>
                <option value="net_90">Net 90</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
          {paymentTerms === 'custom' && (
            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Custom Days"
                type="number"
                min="0"
                value={customDays}
                onChange={(e) => { setCustomDays(e.target.value); setDueDateManual(false); }}
              />
            </div>
          )}
          <Input
            label="Vendor Invoice #"
            value={vendorInvoiceNumber}
            onChange={(e) => setVendorInvoiceNumber(e.target.value)}
            placeholder="The vendor's reference number"
          />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Expense Lines</h2>
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 w-1/3">Account</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2">Description</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase pb-2 w-32">Amount</th>
                <th className="w-8 pb-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="align-top">
                  <td className="pr-2 py-1">
                    <AccountSelector
                      value={line.accountId}
                      onChange={(v) => updateLine(i, 'accountId', v)}
                      accountTypeFilter={['expense', 'asset'] as any}
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      value={line.description}
                      onChange={(e) => updateLine(i, 'description', e.target.value)}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      placeholder="Description"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <MoneyInput value={line.amount} onChange={(v) => updateLine(i, 'amount', v)} />
                  </td>
                  <td className="pl-1 py-1 pt-2.5">
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={() => setLines((p) => [...p, emptyLine()])}
            className="mt-3 flex items-center gap-1 text-sm text-primary-600"
          >
            <Plus className="h-4 w-4" /> Add line
          </button>

          <div className="flex justify-end mt-4 border-t pt-4">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="font-mono">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <Input label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
          <Input label="Internal Notes" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-600">{error.message}</p>}

        <div className="flex gap-3">
          <Button type="submit" loading={isPending && !andNew}>
            {isEdit ? 'Save Changes' : 'Create Bill'}
          </Button>
          {!isEdit && (
            <Button
              type="button"
              variant="secondary"
              loading={isPending && andNew}
              onClick={() => { setAndNew(true); document.querySelector<HTMLFormElement>('form')?.requestSubmit(); }}
            >
              Save + New
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(isEdit ? `/bills/${editId}` : '/bills')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
