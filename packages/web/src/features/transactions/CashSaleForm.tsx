// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.


import { todayLocalISO } from '../../utils/date';
import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { JournalLine } from '@kis-books/shared';
import { useCreateTransaction, useUpdateTransaction, useTransaction } from '../../api/hooks/useTransactions';
import { useCompanySettings } from '../../api/hooks/useCompany';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DatePicker } from '../../components/forms/DatePicker';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { ContactSelector } from '../../components/forms/ContactSelector';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { LineTagPicker } from '../../components/forms/SplitRowV2';
import { ENTRY_FORMS_V2 } from '../../utils/feature-flags';
import { ShortcutTooltip } from '../../components/ui/ShortcutTooltip';
import { useFormShortcuts } from '../../hooks/useFormShortcuts';
import { AttachmentPanel } from '../attachments/AttachmentPanel';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Plus, Trash2 } from 'lucide-react';

interface SaleLine {
  accountId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  isTaxable: boolean;
  taxRate: string;
  tagId: string | null;
  userHasTouchedTag: boolean;
}

function emptyLine(defaultTaxRate: string): SaleLine {
  return {
    accountId: '',
    description: '',
    quantity: '1',
    unitPrice: '',
    isTaxable: true,
    taxRate: defaultTaxRate,
    tagId: null,
    userHasTouchedTag: false,
  };
}

export function CashSaleForm() {
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
  const navigate = useNavigate();
  const createTxn = useCreateTransaction();
  const updateTxn = useUpdateTransaction();
  const { data: existingData, isLoading: loadingExisting } = useTransaction(editId || '');
  const today = todayLocalISO();

  const { data: settingsData } = useCompanySettings();
  const defaultTaxRateDecimal = settingsData?.settings?.defaultSalesTaxRate || '0';
  const defaultTaxRate = (parseFloat(defaultTaxRateDecimal) * 100).toString();

  const [txnDate, setTxnDate] = useState(today);
  const [contactId, setContactId] = useState('');
  const [depositToAccountId, setDepositToAccountId] = useState('');
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<SaleLine[]>([emptyLine(defaultTaxRate)]);
  const [draftId] = useState(() => crypto.randomUUID());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (isEdit && existingData?.transaction && !loaded) {
      const txn = existingData.transaction;
      setTxnDate(txn.txnDate);
      setContactId(txn.contactId || '');
      setMemo(txn.memo || '');

      const txnLines = txn.lines || [];
      // Debit line is deposit-to, credit lines are revenue
      const debitLine = txnLines.find((l: JournalLine) => parseFloat(l.debit) > 0 && !l.description?.includes('Sales Tax'));
      const revenueLines = txnLines.filter((l: JournalLine) => parseFloat(l.credit) > 0 && l.description !== 'Sales Tax');

      if (debitLine) setDepositToAccountId(debitLine.accountId);
      if (revenueLines.length > 0) {
        setLines(revenueLines.map((l: JournalLine) => ({
          accountId: l.accountId,
          description: l.description || '',
          quantity: l.quantity ? parseFloat(l.quantity).toString() : '1',
          unitPrice: l.unitPrice ? parseFloat(l.unitPrice).toString() : parseFloat(l.credit).toString(),
          isTaxable: l.isTaxable || false,
          taxRate: l.taxRate ? (parseFloat(l.taxRate) * 100).toString() : defaultTaxRate,
          tagId: l.tagId ?? null,
          userHasTouchedTag: l.tagId != null,
        })));
      }
      setLoaded(true);
    }
  }, [isEdit, existingData, loaded]);

  const updateLine = (i: number, field: 'accountId' | 'description' | 'quantity' | 'unitPrice' | 'isTaxable' | 'taxRate', value: string | boolean) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const updateLineTag = (i: number, tagId: string | null, touched: boolean) =>
    setLines((prev) =>
      prev.map((l, idx) =>
        idx === i ? { ...l, tagId, userHasTouchedTag: l.userHasTouchedTag || touched } : l,
      ),
    );

  const subtotal = lines.reduce((sum, l) => sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0), 0);
  const totalTax = lines.reduce((sum, l) => {
    if (!l.isTaxable) return sum;
    const lineAmt = (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0);
    return sum + lineAmt * ((parseFloat(l.taxRate) || 0) / 100);
  }, 0);
  const grandTotal = subtotal + totalTax;
  const mutation = isEdit ? updateTxn : createTxn;

  const { formRef, handleKeyDown, saveChord } = useFormShortcuts({
    onSave: () => formRef.current?.requestSubmit(),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    interface CashSalePayload extends Record<string, unknown> {
      txnType: 'cash_sale';
      txnDate: string;
      contactId?: string;
      depositToAccountId: string;
      memo: string;
      lines: Array<{ accountId: string; description: string; quantity: string; unitPrice: string; isTaxable: boolean; taxRate: string; tagId?: string | null }>;
      draftAttachmentId?: string;
    }
    const payload: CashSalePayload = {
      txnType: 'cash_sale',
      txnDate,
      contactId: contactId || undefined,
      depositToAccountId,
      memo,
      lines: lines.filter((l) => l.accountId && l.unitPrice).map((l) => ({
        accountId: l.accountId,
        description: l.description,
        quantity: l.quantity || '1',
        unitPrice: l.unitPrice,
        isTaxable: l.isTaxable,
        taxRate: l.isTaxable ? (parseFloat(l.taxRate) / 100).toString() : '0',
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isEdit ? 'Edit Cash Sale' : 'New Cash Sale'}</h1>
      <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <DatePicker label="Date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
          <ContactSelector label="Customer" value={contactId} onChange={setContactId} contactTypeFilter="customer" />
          <AccountSelector label="Deposit To" value={depositToAccountId} onChange={setDepositToAccountId} accountTypeFilter="asset" required />
          <Input label="Memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Line Items</h2>
          <table className="min-w-full">
            <thead>
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 w-1/3">Account</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2">Description</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase pb-2 w-16">Qty</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase pb-2 w-36">Rate</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase pb-2 w-12">Tax</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase pb-2 w-32">Tax %</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 w-44">Amount</th>
                {ENTRY_FORMS_V2 && (
                  <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 w-40">Tag</th>
                )}
                <th className="w-8 pb-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => {
                const lineAmount = (parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0);
                return (
                  <tr key={i} className="align-top">
                    <td className="pr-2 py-1"><AccountSelector value={line.accountId} onChange={(v) => updateLine(i, 'accountId', v)} accountTypeFilter="revenue" /></td>
                    <td className="px-2 py-1">
                      <input value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Description" />
                    </td>
                    <td className="px-2 py-1">
                      <input value={line.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-center" type="number" min="1" />
                    </td>
                    <td className="px-2 py-1"><MoneyInput value={line.unitPrice} onChange={(v) => updateLine(i, 'unitPrice', v)} /></td>
                    <td className="px-2 py-1 text-center pt-2.5">
                      <input type="checkbox" checked={line.isTaxable} onChange={(e) => updateLine(i, 'isTaxable', e.target.checked)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                    </td>
                    <td className="px-1 py-1">
                      {line.isTaxable && (
                        <input type="number" step="0.0001" value={line.taxRate} onChange={(e) => updateLine(i, 'taxRate', e.target.value)}
                          className="block w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-right" />
                      )}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-sm pt-2.5">${lineAmount.toFixed(2)}</td>
                    {ENTRY_FORMS_V2 && (
                      <td className="px-1 py-1">
                        <LineTagPicker value={line.tagId} onChange={(t, touched) => updateLineTag(i, t, touched)} compact />
                      </td>
                    )}
                    <td className="pl-1 py-1 pt-2.5">
                      {lines.length > 1 && (
                        <button type="button" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button type="button" onClick={() => setLines((p) => [...p, emptyLine(defaultTaxRate)])}
            className="mt-3 flex items-center gap-1 text-sm text-primary-600"><Plus className="h-4 w-4" /> Add line</button>
          <div className="flex justify-end mt-4 border-t pt-4">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">${subtotal.toFixed(2)}</span></div>
              {totalTax > 0 && <div className="flex justify-between text-gray-600"><span>Tax</span><span className="font-mono">${totalTax.toFixed(2)}</span></div>}
              <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span className="font-mono">${grandTotal.toFixed(2)}</span></div>
            </div>
          </div>
        </div>

        {mutation.error && <p className="text-sm text-red-600">{mutation.error.message}</p>}

        <div className="flex flex-wrap gap-3">
          <ShortcutTooltip chord={saveChord}>
            <Button type="submit" loading={mutation.isPending}>{isEdit ? 'Save Changes' : 'Record Cash Sale'}</Button>
          </ShortcutTooltip>
          <Button type="button" variant="secondary" onClick={() => navigate(isEdit ? `/transactions/${editId}` : '/transactions')}>Cancel</Button>
        </div>

        {isEdit
          ? <AttachmentPanel attachableType="cash_sale" attachableId={editId!} />
          : <AttachmentPanel attachableType="draft" attachableId={draftId} />
        }
      </form>
    </div>
  );
}
