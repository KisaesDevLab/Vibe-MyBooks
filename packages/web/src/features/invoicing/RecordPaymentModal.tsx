import { useState, type FormEvent } from 'react';
import type { Transaction } from '@kis-books/shared';
import { useRecordPayment } from '../../api/hooks/useInvoices';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/forms/DatePicker';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { Input } from '../../components/ui/Input';
import { X } from 'lucide-react';

interface RecordPaymentModalProps {
  invoice: Transaction;
  onClose: () => void;
}

export function RecordPaymentModal({ invoice, onClose }: RecordPaymentModalProps) {
  const today = new Date().toISOString().split('T')[0]!;
  const balanceDue = parseFloat(invoice.balanceDue || invoice.total || '0');

  const [amount, setAmount] = useState(balanceDue.toFixed(2));
  const [txnDate, setTxnDate] = useState(today);
  const [depositToAccountId, setDepositToAccountId] = useState('');
  const [memo, setMemo] = useState('');

  const recordPayment = useRecordPayment();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    recordPayment.mutate({
      invoiceId: invoice.id,
      amount,
      txnDate,
      depositToAccountId,
      memo: memo || undefined,
    }, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Record Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
            <div className="flex justify-between"><span>Invoice Total</span><span className="font-mono">${parseFloat(invoice.total || '0').toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Amount Paid</span><span className="font-mono">${parseFloat(invoice.amountPaid || '0').toFixed(2)}</span></div>
            <div className="flex justify-between font-medium border-t pt-1 mt-1"><span>Balance Due</span><span className="font-mono">${balanceDue.toFixed(2)}</span></div>
          </div>

          <MoneyInput label="Payment Amount" value={amount} onChange={setAmount} required />
          <DatePicker label="Payment Date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
          <AccountSelector label="Deposit To" value={depositToAccountId} onChange={setDepositToAccountId}
            accountTypeFilter="asset" required />
          <Input label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} />

          {recordPayment.error && <p className="text-sm text-red-600">{recordPayment.error.message}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={recordPayment.isPending}>Record Payment</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
