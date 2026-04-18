// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.


import { todayLocalISO } from '../../utils/date';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWriteCheck, useCheckSettings } from '../../api/hooks/useChecks';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DatePicker } from '../../components/forms/DatePicker';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { ContactSelector, type ContactSelection } from '../../components/forms/ContactSelector';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { TagSelector } from '../../components/forms/TagSelector';
import { numberToWords } from '@kis-books/shared';
import { Plus, Trash2 } from 'lucide-react';

interface ExpenseLine {
  accountId: string;
  description: string;
  amount: string;
}

export function WriteCheckPage() {
  const navigate = useNavigate();
  const writeCheck = useWriteCheck();
  const { data: settingsData } = useCheckSettings();
  const today = todayLocalISO();

  const [bankAccountId, setBankAccountId] = useState(
    settingsData?.settings?.defaultBankAccountId || '',
  );
  const [contactId, setContactId] = useState('');
  const [payeeNameOnCheck, setPayeeNameOnCheck] = useState('');
  const [txnDate, setTxnDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [printedMemo, setPrintedMemo] = useState('');
  const [memo, setMemo] = useState('');
  const [printLater, setPrintLater] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [lines, setLines] = useState<ExpenseLine[]>([
    { accountId: '', description: '', amount: '' },
  ]);

  const amountWords = numberToWords(amount);
  const linesTotal = lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

  const updateLine = (i: number, field: keyof ExpenseLine, value: string) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));

  const handleContactSelect = (contact: ContactSelection | null) => {
    if (contact) {
      setPayeeNameOnCheck(contact.displayName);
      // Auto-fill first expense line account if the contact has a default
      if (contact.defaultExpenseAccountId && lines.length > 0 && !lines[0]!.accountId) {
        updateLine(0, 'accountId', contact.defaultExpenseAccountId);
      }
    } else {
      setPayeeNameOnCheck('');
    }
  };

  const handleSubmit = (e: FormEvent, queueForPrint: boolean) => {
    e.preventDefault();
    writeCheck.mutate(
      {
        bankAccountId,
        contactId: contactId || undefined,
        payeeNameOnCheck,
        txnDate,
        amount,
        printedMemo: printedMemo || undefined,
        memo: memo || undefined,
        printLater: queueForPrint,
        lines: lines
          .filter((l) => l.accountId && l.amount)
          .map((l) => ({
            accountId: l.accountId,
            description: l.description || undefined,
            amount: l.amount,
          })),
        tagIds: tagIds.length > 0 ? tagIds : undefined,
      },
      { onSuccess: () => navigate('/transactions') },
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Write Check</h1>
      <form
        onSubmit={(e) => handleSubmit(e, printLater)}
        className="max-w-4xl space-y-6"
      >
        {/* Bank Account & Date */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <AccountSelector
              label="Bank Account"
              value={bankAccountId}
              onChange={setBankAccountId}
              accountTypeFilter="asset"
              required
            />
            <DatePicker
              label="Date"
              value={txnDate}
              onChange={(e) => setTxnDate(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Payee & Amount */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <ContactSelector
            label="Pay to the Order of"
            value={contactId}
            onChange={setContactId}
            onSelect={handleContactSelect}
            contactTypeFilter="vendor"
          />
          <Input
            label="Payee Name on Check"
            value={payeeNameOnCheck}
            onChange={(e) => setPayeeNameOnCheck(e.target.value)}
            required
            placeholder="Name as it will appear on the check"
          />
          <div>
            <MoneyInput
              label="Amount"
              value={amount}
              onChange={setAmount}
              required
              className="text-lg font-bold"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              Amount in Words
            </label>
            <div className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 italic min-h-[38px]">
              {amountWords || 'Enter an amount above'}
            </div>
          </div>
        </div>

        {/* Memo fields */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <Input
            label="Printed Memo"
            value={printedMemo}
            onChange={(e) => setPrintedMemo(e.target.value)}
            placeholder="Memo printed on the check"
          />
          <Input
            label="Internal Memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="Internal note (does not print)"
          />
        </div>

        {/* Expense Line Items */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            Expense Line Items
          </h2>
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 w-1/3">
                  Account
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2">
                  Description
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase pb-2 w-28">
                  Amount
                </th>
                <th className="w-10 pb-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i}>
                  <td className="pr-2 py-1">
                    <AccountSelector
                      value={line.accountId}
                      onChange={(v) => updateLine(i, 'accountId', v)}
                      accountTypeFilter="expense"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <input
                      value={line.description}
                      onChange={(e) =>
                        updateLine(i, 'description', e.target.value)
                      }
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      placeholder="Description"
                    />
                  </td>
                  <td className="px-2 py-1">
                    <MoneyInput
                      value={line.amount}
                      onChange={(v) => updateLine(i, 'amount', v)}
                    />
                  </td>
                  <td className="pl-2 py-1">
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setLines((p) => p.filter((_, idx) => idx !== i))
                        }
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
            onClick={() =>
              setLines((p) => [
                ...p,
                { accountId: '', description: '', amount: '' },
              ])
            }
            className="mt-3 flex items-center gap-1 text-sm text-primary-600"
          >
            <Plus className="h-4 w-4" /> Add line item
          </button>

          <div className="flex justify-end mt-4 border-t pt-4">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Lines Total</span>
                <span className="font-mono">${linesTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Check Amount</span>
                <span className="font-mono">
                  ${(parseFloat(amount) || 0).toFixed(2)}
                </span>
              </div>
              {amount &&
                linesTotal > 0 &&
                Math.abs(linesTotal - parseFloat(amount)) > 0.001 && (
                  <p className="text-xs text-amber-600">
                    Line items total does not match the check amount
                  </p>
                )}
            </div>
          </div>
        </div>

        {/* Tags */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <TagSelector label="Tags" value={tagIds} onChange={setTagIds} />
        </div>

        {/* Print Later Toggle */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={printLater}
              onChange={(e) => setPrintLater(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">
                Print Later
              </span>
              <p className="text-xs text-gray-500">
                Queue this check for batch printing
              </p>
            </div>
          </label>
        </div>

        {/* Error */}
        {writeCheck.error && (
          <p className="text-sm text-red-600">{writeCheck.error.message}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            type="submit"
            loading={writeCheck.isPending}
            onClick={(e) => handleSubmit(e, false)}
          >
            Save
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={writeCheck.isPending}
            onClick={(e) => handleSubmit(e, true)}
          >
            Save &amp; Queue for Print
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/transactions')}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
