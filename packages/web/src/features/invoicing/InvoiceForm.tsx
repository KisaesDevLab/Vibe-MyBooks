import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { TagSelector } from '../../components/forms/TagSelector';
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
}

function emptyLine(mode: EntryMode, defaultTaxRate: string = '0'): InvoiceLine {
  return { entryMode: mode, accountId: '', itemId: '', description: '', quantity: '1', unitPrice: '', isTaxable: true, taxRate: defaultTaxRate };
}

export function InvoiceForm() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const isEdit = !!editId;
  const queryClient = useQueryClient();
  const createInvoice = useCreateInvoice();
  const today = new Date().toISOString().split('T')[0]!;

  const [contactId, setContactId] = useState('');
  const [txnDate, setTxnDate] = useState(today);
  const [dueDate, setDueDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('net_30');
  const [memo, setMemo] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [defaultMode, setDefaultMode] = useState<EntryMode>('category');

  // Fetch company default tax rate
  const { data: settingsData } = useCompanySettings();
  // defaultSalesTaxRate is stored as decimal (0.0825) — convert to percent for display (8.25)
  const defaultTaxRateDecimal = settingsData?.settings?.defaultSalesTaxRate || '0';
  const defaultTaxRatePercent = (parseFloat(defaultTaxRateDecimal) * 100).toString();

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

  // Fetch existing invoice for edit mode
  const { data: existingData } = useQuery({
    queryKey: ['invoices', editId],
    queryFn: () => apiClient<{ invoice: any }>(`/invoices/${editId}`),
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
    setDueDateManual(true);

    const invLines = (inv.lines || [])
      .filter((l: any) => parseFloat(l.credit) > 0 && l.accountId)
      .filter((l: any) => l.description !== 'Sales Tax') // exclude the tax liability line
      .map((l: any) => ({
        entryMode: 'category' as EntryMode,
        accountId: l.accountId,
        itemId: '',
        description: l.description || '',
        quantity: l.quantity || '1',
        unitPrice: l.unitPrice || String(parseFloat(l.credit)),
        isTaxable: l.isTaxable ?? true,
        taxRate: l.taxRate ? String(parseFloat(l.taxRate) * 100) : defaultTaxRatePercent,
      }));
    if (invLines.length > 0) setLines(invLines);
    setLoaded(true);
  }, [existingData]);

  const updateInvoice = useMutation({
    mutationFn: (input: any) =>
      apiClient<{ invoice: any }>(`/invoices/${editId}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', editId] });
    },
  });

  const updateLine = (i: number, field: keyof InvoiceLine, value: string) =>
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));

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

  const buildPayload = () => ({
    txnDate,
    dueDate: dueDate || undefined,
    contactId,
    paymentTerms,
    memo: memo || undefined,
    internalNotes: internalNotes || undefined,
    lines: lines.filter((l) => l.accountId && l.unitPrice).map((l) => ({
      accountId: l.accountId,
      description: l.description || undefined,
      quantity: l.quantity || '1',
      unitPrice: l.unitPrice,
      isTaxable: l.isTaxable,
      taxRate: l.isTaxable ? (parseFloat(l.taxRate) / 100).toString() : '0',
    })),
  });

  const resetForNew = () => {
    setContactId('');
    setMemo('');
    setInternalNotes('');
    setTagIds([]);
    setLines([emptyLine(defaultMode, defaultTaxRatePercent)]);
    setDueDateManual(false);
    setAndNew(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();

    if (isEdit) {
      updateInvoice.mutate(payload, {
        onSuccess: () => navigate(`/invoices/${editId}`),
      });
    } else {
      createInvoice.mutate(payload, {
        onSuccess: async (data) => {
          if (tagIds.length > 0) {
            await apiClient(`/tags/transactions/${data.invoice.id}/add`, {
              method: 'POST',
              body: JSON.stringify({ tagIds }),
            }).catch(() => {});
          }
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
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-6 space-y-4">
          <ContactSelector label="Customer" value={contactId} onChange={setContactId} contactTypeFilter="customer" required />
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

          {/* ── Desktop: table layout ── */}
          <div className="hidden md:block">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 w-1/4">
                    {defaultMode === 'item' ? 'Item / Account' : 'Account'}
                  </th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2">Description</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase pb-2 w-16">Qty</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase pb-2 w-36">Rate</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase pb-2 w-12">Tax</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase pb-2 w-32">Tax %</th>
                  <th className="text-right text-xs font-medium text-gray-500 uppercase pb-2 w-24">Amount</th>
                  <th className="w-8 pb-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => {
                  const lineAmount = (parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0);
                  return (
                    <tr key={i} className="align-top">
                      <td className="pr-2 py-1">
                        {line.entryMode === 'item' ? (
                          <SearchableDropdown
                            options={itemOptions}
                            value={line.itemId}
                            onChange={(val) => handleItemSelect(i, val)}
                            placeholder="Select item..."
                          />
                        ) : (
                          <AccountSelector value={line.accountId} onChange={(v) => updateLine(i, 'accountId', v)} accountTypeFilter="revenue" />
                        )}
                      </td>
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
                        <input type="checkbox" checked={line.isTaxable}
                          onChange={(e) => setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, isTaxable: e.target.checked } : l))}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                      </td>
                      <td className="px-1 py-1">
                        {line.isTaxable && (
                          <input type="number" step="0.0001" value={line.taxRate}
                            onChange={(e) => updateLine(i, 'taxRate', e.target.value)}
                            className="block w-full rounded-lg border border-gray-300 px-2 py-2 text-sm text-right" />
                        )}
                      </td>
                      <td className="px-2 py-1 text-right font-mono text-sm pt-2.5">${lineAmount.toFixed(2)}</td>
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
          </div>

          {/* ── Mobile: compact card layout ── */}
          <div className="md:hidden space-y-2">
            {lines.map((line, i) => {
              const lineAmount = (parseFloat(line.quantity) || 0) * (parseFloat(line.unitPrice) || 0);
              return (
                <div key={i} className="border border-gray-200 rounded-lg p-2.5 space-y-2">
                  {/* Row 1: Account/Item selector + delete */}
                  <div className="flex gap-2 items-start">
                    <div className="flex-1">
                      {line.entryMode === 'item' ? (
                        <SearchableDropdown
                          options={itemOptions}
                          value={line.itemId}
                          onChange={(val) => handleItemSelect(i, val)}
                          placeholder="Select item..."
                        />
                      ) : (
                        <AccountSelector value={line.accountId} onChange={(v) => updateLine(i, 'accountId', v)} accountTypeFilter="revenue" />
                      )}
                    </div>
                    {lines.length > 1 && (
                      <button type="button" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500 mt-2 shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Row 2: Description */}
                  <input value={line.description} onChange={(e) => updateLine(i, 'description', e.target.value)}
                    className="block w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm" placeholder="Description" />

                  {/* Row 3: Qty × Rate = Amount */}
                  <div className="flex items-center gap-2">
                    <input value={line.quantity} onChange={(e) => updateLine(i, 'quantity', e.target.value)}
                      className="w-14 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-center shrink-0" type="number" min="1" placeholder="Qty" />
                    <span className="text-gray-400 text-xs shrink-0">&times;</span>
                    <div className="flex-1"><MoneyInput value={line.unitPrice} onChange={(v) => updateLine(i, 'unitPrice', v)} /></div>
                    <span className="text-gray-400 text-xs shrink-0">=</span>
                    <span className="font-mono font-semibold text-sm w-20 text-right shrink-0">${lineAmount.toFixed(2)}</span>
                  </div>

                  {/* Row 4: Tax toggle (compact) */}
                  <div className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={line.isTaxable}
                      onChange={(e) => setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, isTaxable: e.target.checked } : l))}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                    <span className="text-gray-600 text-xs">Tax</span>
                    {line.isTaxable && (
                      <>
                        <input type="number" step="0.0001" value={line.taxRate}
                          onChange={(e) => updateLine(i, 'taxRate', e.target.value)}
                          className="w-16 rounded border border-gray-300 px-1.5 py-0.5 text-xs text-right" />
                        <span className="text-xs text-gray-400">%</span>
                      </>
                    )}
                  </div>
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
          {!isEdit && <TagSelector label="Tags" value={tagIds} onChange={setTagIds} />}
        </div>

        {error && <p className="text-sm text-red-600">{error.message}</p>}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={isPending && !andNew}>{isEdit ? 'Save Changes' : 'Create Invoice'}</Button>
          {!isEdit && (
            <Button type="button" variant="secondary" loading={isPending && andNew}
              onClick={() => { setAndNew(true); document.querySelector<HTMLFormElement>('form')?.requestSubmit(); }}>
              Create + New
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={() => navigate(isEdit ? `/invoices/${editId}` : '/invoices')}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
