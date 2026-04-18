// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.


import { todayLocalISO } from '../../utils/date';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AccountType } from '@kis-books/shared';
import { useCreateVendorCredit } from '../../api/hooks/useAp';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DatePicker } from '../../components/forms/DatePicker';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { ContactSelector } from '../../components/forms/ContactSelector';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { Plus, Trash2 } from 'lucide-react';

interface CreditLine {
  accountId: string;
  description: string;
  amount: string;
}

const emptyLine = (): CreditLine => ({ accountId: '', description: '', amount: '' });

export function EnterVendorCreditPage() {
  const navigate = useNavigate();
  const today = todayLocalISO();
  const createCredit = useCreateVendorCredit();

  const [contactId, setContactId] = useState('');
  const [txnDate, setTxnDate] = useState(today);
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<CreditLine[]>([emptyLine()]);

  const updateLine = (i: number, field: keyof CreditLine, value: string) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));

  const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      contactId,
      txnDate,
      vendorInvoiceNumber: vendorInvoiceNumber || undefined,
      memo: memo || undefined,
      lines: lines
        .filter((l) => l.accountId && l.amount && parseFloat(l.amount) > 0)
        .map((l) => ({
          accountId: l.accountId,
          description: l.description || undefined,
          amount: l.amount,
        })),
    };
    if (payload.lines.length === 0) return;
    createCredit.mutate(payload, {
      onSuccess: () => navigate('/vendor-credits'),
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Enter Vendor Credit</h1>
      <form onSubmit={handleSubmit} className="space-y-6 max-w-5xl">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <ContactSelector
            label="Vendor"
            value={contactId}
            onChange={setContactId}
            contactTypeFilter="vendor"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <DatePicker label="Credit Date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
            <Input
              label="Vendor Credit Memo #"
              value={vendorInvoiceNumber}
              onChange={(e) => setVendorInvoiceNumber(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Credit Lines</h2>
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
                      accountTypeFilter={['expense', 'asset'] as AccountType[]}
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
                <span>Total Credit</span>
                <span className="font-mono">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <Input label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>

        {createCredit.error && <p className="text-sm text-red-600">{createCredit.error.message}</p>}

        <div className="flex gap-3">
          <Button type="submit" loading={createCredit.isPending}>Create Vendor Credit</Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/vendor-credits')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
