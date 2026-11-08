// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.


import { todayLocalISO } from '../../utils/date';
import { useState, type FormEvent } from 'react';
import type { PaymentMethod, Transaction } from '@kis-books/shared';
import { useRecordPayment } from '../../api/hooks/useInvoices';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/forms/DatePicker';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { PaymentMethodSelect } from '../../components/forms/PaymentMethodSelect';
import { Input } from '../../components/ui/Input';
import { X } from 'lucide-react';
import { roundCents, splitPayment } from './paymentAmount';

interface RecordPaymentModalProps {
  invoice: Transaction;
  onClose: () => void;
}

export function RecordPaymentModal({ invoice, onClose }: RecordPaymentModalProps) {
  const today = todayLocalISO();
  // Exact cents from the decimal strings, rounded half away from zero like
  // the engine (no float: 10.005 must default to 10.01, the engine's cap).
  // A paid invoice takes nothing; the whole payment would be a credit.
  const balanceRaw = roundCents(invoice.balanceDue || invoice.total || '0') ?? '0.00';
  const balanceDue = invoice.invoiceStatus === 'paid' || balanceRaw.startsWith('-') ? '0.00' : balanceRaw;

  const [amount, setAmount] = useState(balanceDue);
  const [txnDate, setTxnDate] = useState(today);
  const [depositToAccountId, setDepositToAccountId] = useState('');
  const [memo, setMemo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>('');
  const [refNo, setRefNo] = useState('');

  const recordPayment = useRecordPayment();
  const split = splitPayment(amount, balanceDue);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    recordPayment.mutate({
      invoiceId: invoice.id,
      amount,
      txnDate,
      depositToAccountId,
      memo: memo || undefined,
      paymentMethod: paymentMethod || undefined,
      refNo: refNo.trim() || undefined,
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
            <div className="flex justify-between"><span>Invoice Total</span><span className="font-mono">${roundCents(invoice.total || '0') ?? '0.00'}</span></div>
            <div className="flex justify-between"><span>Amount Paid</span><span className="font-mono">${roundCents(invoice.amountPaid || '0') ?? '0.00'}</span></div>
            <div className="flex justify-between font-medium border-t pt-1 mt-1"><span>Balance Due</span><span className="font-mono">${balanceDue}</span></div>
          </div>

          <MoneyInput label="Payment Amount" value={amount} onChange={setAmount} required />
          {split && split.excess !== '0.00' && (
            // Allowed, not an error: the engine applies the balance and keeps
            // the rest on the customer's account as an unapplied credit.
            <div role="note" className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
              This is ${split.excess} more than the balance due. ${split.applied} pays this invoice
              {split.applied === balanceDue && balanceDue !== '0.00' ? ' in full' : ''}, and the
              extra ${split.excess} becomes a credit for the customer that you can apply to another invoice.
            </div>
          )}
          <DatePicker label="Payment Date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
          <AccountSelector label="Deposit To" value={depositToAccountId} onChange={setDepositToAccountId}
            accountTypeFilter="asset" required />
          <div className="grid grid-cols-2 gap-3">
            <PaymentMethodSelect value={paymentMethod} onChange={setPaymentMethod} />
            <Input label="Ref #" value={refNo} onChange={(e) => setRefNo(e.target.value)} maxLength={100} />
          </div>
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
