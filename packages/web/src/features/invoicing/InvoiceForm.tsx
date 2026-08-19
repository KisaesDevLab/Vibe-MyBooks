// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.


import { todayLocalISO } from '../../utils/date';
import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { JournalLine, Transaction } from '@kis-books/shared';
import { useCreateInvoice } from '../../api/hooks/useInvoices';
import { useItems } from '../../api/hooks/useItems';
import { useCompanySettings } from '../../api/hooks/useCompany';
import { apiClient } from '../../api/client';
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
import { SearchableDropdown } from '../../components/forms/SearchableDropdown';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Plus, Trash2 } from 'lucide-react';

type EntryMode = 'category' | 'item';

interface InvoiceLine {
  entryMode: EntryMode;
  accountId: string;
  itemId: string;
  description: string;
  quantity: string;
  unitPrice: string;
  isTaxable: boolean;
  taxRate: string;
  tagId: string | null;
  userHasTouchedTag: boolean;
}

function emptyLine(mode: EntryMode, defaultTaxRate: string = '0'): InvoiceLine {
  return {
    entryMode: mode,
    accountId: '',
    itemId: '',
    description: '',
    quantity: '1',
    unitPrice: '',
    isTaxable: true,
    taxRate: defaultTaxRate,
    tagId: null,
    userHasTouchedTag: false,
  };
}

export function InvoiceForm() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
  const queryClient = useQueryClient();
  const createInvoice = useCreateInvoice();
  const today = todayLocalISO();

  const [contactId, setContactId] = useState('');
  const [txnDate, setTxnDate] = useState(today);
  const [dueDate, setDueDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('net_30');
  const [memo, setMemo] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [defaultMode, setDefaultMode] = useState<EntryMode>('category');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [numberTouched, setNumberTouched] = useState(false);

  // Fetch company default tax rate
  const { data: settingsData } = useCompanySettings();
  // defaultSalesTaxRate is stored as decimal (0.0825) — convert to percent for display (8.25)
  const defaultTaxRateDecimal = settingsData?.settings?.defaultSalesTaxRate || '0';
  const defaultTaxRatePercent = (parseFloat(defaultTaxRateDecimal) * 100).toString();
  // The number a new invoice would auto-receive (prefix + next counter value),
  // used to prefill the editable Invoice # field. If the user leaves it as-is
  // on a new invoice we omit it from the payload so the server assigns and
  // advances the counter atomically.
  const invoicePrefix = settingsData?.settings?.invoicePrefix ?? 'INV-';
  const invoiceNextNumber = settingsData?.settings?.invoiceNextNumber;
  const autoNumber = invoiceNextNumber != null ? `${invoicePrefix}${invoiceNextNumber}` : '';

  const [lines, setLines] = useState<InvoiceLine[]>([emptyLine('category', defaultTaxRatePercent)]);
  const [loaded, setLoaded] = useState(!isEdit);
  const [dueDateManual, setDueDateManual] = useState(false);
  const [andNew, setAndNew] = useState(false);

  // Fetch items for item-mode lines
  const { data: itemsData } = useItems({ isActive: true, limit: 500 });
  const itemOptions = (itemsData?.data || []).map((item) => ({
    id: item.id,
    label: item.name,
    sublabel: item.unitPrice ? `$${parseFloat(item.unitPrice).toFixed(2)}` : undefined,
  }));

  function calcDueDate(invoiceDate: string, terms: string): string {
    const d = new Date(invoiceDate);
    switch (terms) {
      case 'due_on_receipt': return invoiceDate;
      case 'net_15': d.setDate(d.getDate() + 15); break;
      case 'net_30': d.setDate(d.getDate() + 30); break;
      case 'net_60': d.setDate(d.getDate() + 60); break;
      case 'net_90': d.setDate(d.getDate() + 90); break;
      default: return '';
    }
    return d.toISOString().split('T')[0]!;
  }

  useEffect(() => {
    if (!isEdit && !dueDateManual && txnDate) {
      setDueDate(calcDueDate(txnDate, paymentTerms));
    }
  }, [txnDate, paymentTerms, isEdit, dueDateManual]);

  // Prefill the Invoice # for a new invoice with the next auto number, until
  // the user edits it. (On edit mode the number is hydrated from the invoice.)
  useEffect(() => {
    if (!isEdit && !numberTouched && autoNumber) setInvoiceNumber(autoNumber);
  }, [autoNumber, isEdit, numberTouched]);

  // Fetch existing invoice for edit mode
  const { data: existingData } = useQuery({
    queryKey: ['invoices', editId],
    queryFn: () => apiClient<{ invoice: Transaction }>(`/invoices/${editId}`),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!existingData?.invoice) return;
    const inv = existingData.invoice;
    setContactId(inv.contactId || '');
    setTxnDate(inv.txnDate || today);
    setDueDate(inv.dueDate || '');
    setPaymentTerms(inv.paymentTerms || 'net_30');
    setMemo(inv.memo || '');
    setInternalNotes(inv.internalNotes || '');
    setInvoiceNumber(inv.txnNumber || '');
    setNumberTouched(true);
    setDueDateManual(true);

    const invLines = (inv.lines || [])
      .filter((l: JournalLine) => parseFloat(l.credit) > 0 && l.accountId)
      .filter((l: JournalLine) => l.description !== 'Sales Tax') // exclude the tax liability line
      .map((l: JournalLine) => ({
        entryMode: 'category' as EntryMode,
        accountId: l.accountId,
        itemId: '',
        description: l.description || '',
        quantity: l.quantity || '1',
        unitPrice: l.unitPrice || String(parseFloat(l.credit)),
        isTaxable: l.isTaxable ?? true,
        taxRate: l.taxRate ? String(parseFloat(l.taxRate) * 100) : defaultTaxRatePercent,
        tagId: l.tagId ?? null,
        userHasTouchedTag: l.tagId != null,
      }));
    if (invLines.length > 0) setLines(invLines);
    setLoaded(true);
    // Intentionally only [existingData]: this hydrates the form once from the
    // fetched invoice, snapshotting `today`/`defaultTaxRatePercent` at that
    // moment. Re-running on those would clobber the user's in-progress edits.
  }, [existingData]);

  const updateInvoice = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiClient<{ invoice: Transaction }>(`/invoices/${editId}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', editId] });
    },
  });

  const updateLine = (i: number, field: 'accountId' | 'itemId' | 'description' | 'quantity' | 'unitPrice' | 'taxRate', value: string) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

  const updateLineTag = (i: number, tagId: string | null, touched: boolean) =>
    setLines((prev) =>
      prev.map((l, idx) =>
        idx === i ? { ...l, tagId, userHasTouchedTag: l.userHasTouchedTag || touched } : l,
      ),
    );

  const handleItemSelect = (i: number, itemId: string) => {
    const item = itemsData?.data?.find((it) => it.id === itemId);
    if (!item) return;
    setLines((prev) => prev.map((l, idx) => idx === i ? {
      ...l,
      itemId,
      accountId: item.incomeAccountId,
      description: item.description || item.name,
      unitPrice: item.unitPrice || '',
      isTaxable: item.isTaxable,
    } : l));
  };

  const toggleLineMode = (i: number) => {
    setLines((prev) => prev.map((l, idx) => idx === i ? {
      ...l,
      entryMode: l.entryMode === 'category' ? 'item' : 'category',
      itemId: '',
    } : l));
  };

  const subtotal = lines.reduce((sum, l) => sum + (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0), 0);
  const totalTax = lines.reduce((sum, l) => {
    if (!l.isTaxable) return sum;
    const lineAmt = (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0);
    return sum + lineAmt * ((parseFloat(l.taxRate) || 0) / 100);
  }, 0);
  const grandTotal = subtotal + totalTax;

  const buildPayload = () => {
    const trimmedNumber = invoiceNumber.trim();
    // Send the number when editing (so a changed number persists), or when
    // creating and the user overrode the auto-suggested value. Omitting it on
    // a fresh invoice lets the server assign + advance the counter atomically.
    const includeNumber = isEdit
      ? trimmedNumber !== ''
      : numberTouched && trimmedNumber !== '' && trimmedNumber !== autoNumber;
    return {
    txnDate,
    dueDate: dueDate || undefined,
    contactId,
    paymentTerms,
    memo: memo || undefined,
    internalNotes: internalNotes || undefined,
    ...(includeNumber ? { txnNumber: trimmedNumber } : {}),
    lines: lines.filter((l) => l.accountId && l.unitPrice).map((l) => ({
      accountId: l.accountId,
      description: l.description || undefined,
      quantity: l.quantity || '1',
      unitPrice: l.unitPrice,
      isTaxable: l.isTaxable,
      taxRate: l.isTaxable ? (parseFloat(l.taxRate) / 100).toString() : '0',
      tagId: l.tagId,
    })),
    };
  };

  const [clientError, setClientError] = useState<string | null>(null);

  const resetForNew = () => {
    setContactId('');
    setMemo('');
    setInternalNotes('');
    setLines([emptyLine(defaultMode, defaultTaxRatePercent)]);
    setDueDateManual(false);
    setAndNew(false);
    // Clear any "add at least one line" error from the previous
    // submission so it doesn't sit stale on the freshly-reset form
    // and confuse the user about the new state.
    setClientError(null);
  };

  const { formRef, handleKeyDown, saveChord, saveAndNewChord } = useFormShortcuts({
    onSave: () => { setAndNew(false); formRef.current?.requestSubmit(); },
    onSaveAndNew: isEdit ? undefined : () => { setAndNew(true); formRef.current?.requestSubmit(); },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setClientError(null);
    const payload = buildPayload();

    // buildPayload silently filters out lines without an account or
    // unitPrice. If every row is incomplete (e.g. user pressed
    // Save+New too fast and reset cleared the form), `lines` is
    // empty and the server rejects with a 400. Catch the empty
    // case here so the operator gets an inline message rather than
    // a generic mutation error.
    if (payload.lines.length === 0) {
      setClientError('Add at least one line item with an account and unit price before saving.');
      return;
    }

    if (isEdit) {
      updateInvoice.mutate(payload, {
        onSuccess: () => navigate(`/invoices/${editId}`),
      });
    } else {
      createInvoice.mutate(payload, {
        onSuccess: (data) => {
          if (andNew) {
            resetForNew();
          } else {
            navigate(`/invoices/${data.invoice.id}`);
          }
        },
      });
    }
  };

  const error = isEdit ? updateInvoice.error : createInvoice.error;
  const isPending = isEdit ? updateInvoice.isPending : createInvoice.isPending;

  if (!loaded) return <LoadingSpinner className="py-12" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{isEdit ? 'Edit Invoice' : 'New Invoice'}</h1>
      <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
          <ContactSelector label="Customer" value={contactId} onChange={setContactId} contactTypeFilter="customer" required />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice #</label>
              <input value={invoiceNumber}
                onChange={(e) => { setInvoiceNumber(e.target.value); setNumberTouched(true); }}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono !max-w-[75%] sm:!max-w-none"
                placeholder="Auto" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <DatePicker label="Invoice Date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required className="!max-w-[75%] sm:!max-w-none" />
            <DatePicker label="Due Date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); setDueDateManual(true); }} className="!max-w-[75%] sm:!max-w-none" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
              <select value={paymentTerms} onChange={(e) => { setPaymentTerms(e.target.value); setDueDateManual(false); }}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="due_on_receipt">Due On Receipt</option>
                <option value="net_15">Net 15</option>
                <option value="net_30">Net 30</option>
                <option value="net_60">Net 60</option>
                <option value="net_90">Net 90</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-700">Line Items</h2>
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-xs">
              <button type="button"
                onClick={() => {
                  setDefaultMode('category');
                  setLines((prev) => prev.map((l) => ({ ...l, entryMode: 'category' })));
                }}
                className={`px-3 py-1 font-medium ${defaultMode === 'category' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                Category
              </button>
              <button type="button"
                onClick={() => {
                  setDefaultMode('item');
                  setLines((prev) => prev.map((l) => ({ ...l, entryMode: 'item' })));
                }}
                className={`px-3 py-1 font-medium ${defaultMode === 'item' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                Item
              </button>
            </div>
          </div>

          {/* ── Desktop: two-row card layout ── */}
          <div className="hidden md:block space-y-2">
            {lines.map((line, i) => {
              const lineAmount = (parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0);
              const fieldLabel = 'block text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1';
              return (
                <div key={i} className="group relative rounded-lg border border-gray-200 bg-gray-50/60 p-3 pr-10 transition-colors hover:border-gray-300">
                  {/* Delete (top-right, hover-revealed) */}
                  {lines.length > 1 && (
                    <button type="button" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}
                      title="Remove line"
                      className="absolute right-2 top-2 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}

                  {/* Row 1: what — Item/Account + Description */}
                  <div className="flex items-start gap-3">
                    <div className="w-2/5 shrink-0">
                      <label className={fieldLabel}>{defaultMode === 'item' ? 'Item / Account' : 'Account'}</label>
                      {line.entryMode === 'item' ? (
                        <SearchableDropdown
                          options={itemOptions}
                          value={line.itemId}
                          onChange={(val) => handleItemSelect(i, val)}
                          placeholder="Select item..."
                        />
                      ) : (
                        <AccountSelector value={line.accountId} onChange={(v) => updateLine(i, 'accountId', v)} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className={fieldLabel}>Description</label>
                      <input value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Description" />
                    </div>
                  </div>

                  {/* Row 2: numbers — Qty · Rate · Tax · Tag · Amount */}
                  <div className="flex items-end gap-3 mt-3">
                    <div className="w-20">
                      <label className={fieldLabel}>Qty</label>
                      <input value={line.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-center" type="number" min="0" step="any" />
                    </div>
                    <div className="w-36">
                      <label className={fieldLabel}>Rate</label>
                      <MoneyInput value={line.unitPrice} onChange={(v) => updateLine(i, 'unitPrice', v)} />
                    </div>
                    <div className="w-14">
                      <label className={`${fieldLabel} text-center`}>Tax</label>
                      <div className="flex h-[38px] items-center justify-center">
                        <input type="checkbox" checked={line.isTaxable}
                          onChange={(e) => setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, isTaxable: e.target.checked } : l))}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                      </div>
                    </div>
                    <div className="w-24">
                      {line.isTaxable && (
                        <>
                          <label className={fieldLabel}>Tax %</label>
                          <input type="number" step="0.0001" value={line.taxRate}
                            onChange={(e) => updateLine(i, 'taxRate', e.target.value)}
                            className="block w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-right" />
                        </>
                      )}
                    </div>
                    {ENTRY_FORMS_V2 && (
                      <div className="w-44">
                        <label className={fieldLabel}>Tag</label>
                        <LineTagPicker value={line.tagId} onChange={(t, touched) => updateLineTag(i, t, touched)} compact />
                      </div>
                    )}
                    <div className="ml-auto text-right">
                      <label className={`${fieldLabel} text-right`}>Amount</label>
                      <div className="font-mono text-base font-semibold text-gray-900 leading-[38px]">${lineAmount.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Mobile: labelled card per line. Every control keeps the
              standard py-2 / text-sm height so the row reads as one form,
              and the tag picker is present here too (it was desktop-only). ── */}
          <div className="md:hidden space-y-3">
            {lines.map((line, i) => {
              const lineAmount = (parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0);
              const lbl = 'block text-xs font-medium text-gray-500 uppercase mb-1';
              return (
                <div key={i} className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
                  <div className="col-span-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700">Line {i + 1}</span>
                    {lines.length > 1 && (
                      <button type="button" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500" aria-label={`Remove line ${i + 1}`}>
                        <Trash2 className="h-4 w-4" /> Remove
                      </button>
                    )}
                  </div>
                  <div className="col-span-2">
                    <span className={lbl}>{line.entryMode === 'item' ? 'Item' : 'Account'}</span>
                    {line.entryMode === 'item' ? (
                      <SearchableDropdown
                        options={itemOptions}
                        value={line.itemId}
                        onChange={(val) => handleItemSelect(i, val)}
                        placeholder="Select item..."
                      />
                    ) : (
                      <AccountSelector value={line.accountId} onChange={(v) => updateLine(i, 'accountId', v)} />
                    )}
                  </div>
                  <div className="col-span-2">
                    <span className={lbl}>Description</span>
                    <input value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" placeholder="Description" />
                  </div>
                  <div className="col-span-1">
                    <span className={lbl}>Qty</span>
                    <input value={line.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-center shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" type="number" min="0" step="any" placeholder="Qty" />
                  </div>
                  <div className="col-span-1">
                    <span className={lbl}>Rate</span>
                    <MoneyInput value={line.unitPrice} onChange={(v) => updateLine(i, 'unitPrice', v)} />
                  </div>
                  <div className="col-span-1">
                    <span className={lbl}>Taxable</span>
                    <label className="inline-flex h-[38px] items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={line.isTaxable}
                        onChange={(e) => setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, isTaxable: e.target.checked } : l))}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                      {line.isTaxable ? 'Yes' : 'No'}
                    </label>
                  </div>
                  <div className="col-span-1">
                    {line.isTaxable && (
                      <>
                        <span className={lbl}>Tax %</span>
                        <input type="number" step="0.0001" value={line.taxRate}
                          onChange={(e) => updateLine(i, 'taxRate', e.target.value)}
                          className="block w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-right shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />
                      </>
                    )}
                  </div>
                  <div className="col-span-2 text-right">
                    <span className={lbl}>Amount</span>
                    <div className="font-mono text-base font-semibold text-gray-900 leading-[38px]">${lineAmount.toFixed(2)}</div>
                  </div>
                  {ENTRY_FORMS_V2 && (
                    <div className="col-span-2">
                      <span className={lbl}>Tag</span>
                      <LineTagPicker value={line.tagId} onChange={(t, touched) => updateLineTag(i, t, touched)} compact />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button type="button" onClick={() => setLines((p) => [...p, emptyLine(defaultMode, defaultTaxRatePercent)])}
            className="mt-3 flex items-center gap-1 text-sm text-primary-600"><Plus className="h-4 w-4" /> Add line item</button>

          <div className="flex justify-end mt-4 border-t pt-4">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">${subtotal.toFixed(2)}</span></div>
              {totalTax > 0 && (
                <div className="flex justify-between text-gray-600"><span>Tax</span><span className="font-mono">${totalTax.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Total</span><span className="font-mono">${grandTotal.toFixed(2)}</span></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
          <Input label="Memo to Customer" value={memo} onChange={(e) => setMemo(e.target.value)} />
          <Input label="Internal Notes" value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
        </div>

        {clientError && <p className="text-sm text-red-600">{clientError}</p>}
        {error && <p className="text-sm text-red-600">{error.message}</p>}

        <div className="flex flex-wrap gap-3">
          <ShortcutTooltip chord={saveChord}>
            <Button type="submit" loading={isPending && !andNew}>{isEdit ? 'Save Changes' : 'Create Invoice'}</Button>
          </ShortcutTooltip>
          {!isEdit && (
            <ShortcutTooltip chord={saveAndNewChord}>
              <Button type="button" variant="secondary" loading={isPending && andNew}
                onClick={() => { setAndNew(true); formRef.current?.requestSubmit(); }}>
                Create + New
              </Button>
            </ShortcutTooltip>
          )}
          <Button type="button" variant="secondary" onClick={() => navigate(isEdit ? `/invoices/${editId}` : '/invoices')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
