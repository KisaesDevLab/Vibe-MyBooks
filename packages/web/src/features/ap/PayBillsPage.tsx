import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePayableBills, usePayBills } from '../../api/hooks/useAp';
import { useCheckSettings } from '../../api/hooks/useChecks';
import { Button } from '../../components/ui/Button';
import { DatePicker } from '../../components/forms/DatePicker';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { MoneyInput } from '../../components/forms/MoneyInput';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import type { BillPaymentMethod } from '@kis-books/shared';

interface BillSelection {
  selected: boolean;
  amount: string;
}

interface CreditSelection {
  selected: boolean;
  amount: string;
  // The bill the credit is allocated to. Defaults to the oldest selected bill
  // for the same vendor; user can change.
  billId: string;
}

export function PayBillsPage() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0]!;
  const { data: settingsData } = useCheckSettings();

  const [bankAccountId, setBankAccountId] = useState(
    settingsData?.settings?.defaultBankAccountId || '',
  );
  const [txnDate, setTxnDate] = useState(today);
  const [method, setMethod] = useState<BillPaymentMethod>('check');
  const [vendorFilter, setVendorFilter] = useState<string>('');
  const [dueOnOrBefore, setDueOnOrBefore] = useState<string>('');

  const { data, isLoading } = usePayableBills({
    contactId: vendorFilter || undefined,
    dueOnOrBefore: dueOnOrBefore || undefined,
  });
  const payBills = usePayBills();

  // Local form state, keyed by bill/credit id
  const [billSelections, setBillSelections] = useState<Record<string, BillSelection>>({});
  const [creditSelections, setCreditSelections] = useState<Record<string, CreditSelection>>({});

  // Sync default bank account once settings load
  useEffect(() => {
    if (!bankAccountId && settingsData?.settings?.defaultBankAccountId) {
      setBankAccountId(settingsData.settings.defaultBankAccountId);
    }
  }, [settingsData, bankAccountId]);

  const bills = data?.bills || [];
  const credits = data?.credits || [];

  // Group bills by vendor for credit-allocation logic
  const billsByVendor = useMemo(() => {
    const m = new Map<string, typeof bills>();
    for (const b of bills) {
      if (!b.contactId) continue;
      const arr = m.get(b.contactId) || [];
      arr.push(b);
      m.set(b.contactId, arr);
    }
    return m;
  }, [bills]);

  const toggleBill = (billId: string, balanceDue: string) => {
    setBillSelections((prev) => {
      const cur = prev[billId];
      if (cur?.selected) {
        const next = { ...prev };
        delete next[billId];
        return next;
      }
      return { ...prev, [billId]: { selected: true, amount: parseFloat(balanceDue || '0').toFixed(2) } };
    });
  };

  const updateBillAmount = (billId: string, amount: string) => {
    setBillSelections((prev) => ({
      ...prev,
      [billId]: { selected: true, amount },
    }));
  };

  const toggleCredit = (creditId: string, balanceDue: string, vendorId: string | null) => {
    setCreditSelections((prev) => {
      const cur = prev[creditId];
      if (cur?.selected) {
        const next = { ...prev };
        delete next[creditId];
        return next;
      }
      // Auto-allocate to the oldest selected bill for the same vendor
      const vendorBills = vendorId ? billsByVendor.get(vendorId) || [] : [];
      const targetBill = vendorBills.find((b) => billSelections[b.id]?.selected);
      if (!targetBill) return prev; // ignore until a bill from this vendor is selected
      return {
        ...prev,
        [creditId]: {
          selected: true,
          amount: parseFloat(balanceDue || '0').toFixed(2),
          billId: targetBill.id,
        },
      };
    });
  };

  const updateCreditAmount = (creditId: string, amount: string) => {
    setCreditSelections((prev) => {
      const cur = prev[creditId];
      if (!cur) return prev;
      return { ...prev, [creditId]: { ...cur, amount } };
    });
  };

  const updateCreditBill = (creditId: string, billId: string) => {
    setCreditSelections((prev) => {
      const cur = prev[creditId];
      if (!cur) return prev;
      return { ...prev, [creditId]: { ...cur, billId } };
    });
  };

  // Aggregates
  const selectedBillIds = Object.keys(billSelections).filter((id) => billSelections[id]?.selected);
  const totalBills = selectedBillIds.reduce(
    (s, id) => s + (parseFloat(billSelections[id]?.amount || '0') || 0),
    0,
  );
  const selectedCreditIds = Object.keys(creditSelections).filter((id) => creditSelections[id]?.selected);
  const totalCredits = selectedCreditIds.reduce(
    (s, id) => s + (parseFloat(creditSelections[id]?.amount || '0') || 0),
    0,
  );
  const netPayment = Math.max(0, totalBills - totalCredits);

  const filteredCredits = useMemo(() => {
    // Only show credits for vendors who have a selected bill
    const selectedVendors = new Set(
      selectedBillIds
        .map((id) => bills.find((b) => b.id === id)?.contactId)
        .filter((v): v is string => !!v),
    );
    return credits.filter((c) => c.contactId && selectedVendors.has(c.contactId));
  }, [credits, bills, selectedBillIds]);

  // Disable credits whose vendor was deselected
  useEffect(() => {
    setCreditSelections((prev) => {
      const next: Record<string, CreditSelection> = {};
      for (const [cid, cs] of Object.entries(prev)) {
        const credit = credits.find((c) => c.id === cid);
        if (!credit?.contactId) continue;
        const vendorBills = billsByVendor.get(credit.contactId) || [];
        const stillSelected = vendorBills.some((b) => billSelections[b.id]?.selected);
        if (stillSelected) {
          // Make sure billId still points to a selected bill
          const targetBill = vendorBills.find((b) => billSelections[b.id]?.selected);
          next[cid] = { ...cs, billId: targetBill?.id || cs.billId };
        }
      }
      return next;
    });
  }, [billSelections, credits, billsByVendor]);

  const canSubmit = bankAccountId && selectedBillIds.length > 0;

  const handlePay = () => {
    if (!canSubmit) return;
    const billsPayload = selectedBillIds.map((id) => ({
      billId: id,
      amount: billSelections[id]!.amount,
    }));
    const creditsPayload = selectedCreditIds
      .map((id) => {
        const sel = creditSelections[id]!;
        return { creditId: id, billId: sel.billId, amount: sel.amount };
      })
      .filter((c) => c.billId);

    payBills.mutate(
      {
        bankAccountId,
        txnDate,
        method,
        printLater: method === 'check',
        bills: billsPayload,
        credits: creditsPayload.length > 0 ? creditsPayload : undefined,
      },
      {
        onSuccess: () => {
          if (method === 'check') navigate('/checks/print');
          else navigate('/bill-payments');
        },
      },
    );
  };

  if (isLoading) return <LoadingSpinner className="py-12" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Pay Bills</h1>

      {/* Payment setup */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-4">
        <div className="grid grid-cols-3 gap-4">
          <AccountSelector
            label="Pay From"
            value={bankAccountId}
            onChange={setBankAccountId}
            accountTypeFilter="asset"
            required
          />
          <DatePicker label="Payment Date" value={txnDate} onChange={(e) => setTxnDate(e.target.value)} required />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as BillPaymentMethod)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="check">Check (Print Later)</option>
              <option value="check_handwritten">Check (Hand-written)</option>
              <option value="ach">ACH</option>
              <option value="credit_card">Credit Card</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-4">
          <DatePicker
            label="Show bills due on or before"
            value={dueOnOrBefore}
            onChange={(e) => setDueOnOrBefore(e.target.value)}
          />
        </div>
      </div>

      {/* Bills */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Unpaid Bills</h2>
        {bills.length === 0 ? (
          <p className="text-sm text-gray-500">No unpaid bills found.</p>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="w-8" />
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 px-2">Vendor</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 px-2">Bill #</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 px-2">Vendor Inv #</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 px-2">Due</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase pb-2 px-2">Balance</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase pb-2 px-2 w-32">Payment</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => {
                const sel = billSelections[b.id];
                const balance = parseFloat(b.balanceDue || '0');
                const overdue = b.daysOverdue && b.daysOverdue > 0;
                return (
                  <tr key={b.id} className="border-b last:border-0">
                    <td className="py-2 pr-1">
                      <input
                        type="checkbox"
                        checked={!!sel?.selected}
                        onChange={() => toggleBill(b.id, b.balanceDue || '0')}
                      />
                    </td>
                    <td className="py-2 px-2 text-sm">{b.contactName}</td>
                    <td className="py-2 px-2 text-sm font-mono">{b.txnNumber}</td>
                    <td className="py-2 px-2 text-sm">{b.vendorInvoiceNumber || '—'}</td>
                    <td className={`py-2 px-2 text-sm ${overdue ? 'text-red-600 font-medium' : ''}`}>
                      {b.dueDate || '—'}
                      {overdue ? ` (${b.daysOverdue}d)` : ''}
                    </td>
                    <td className="py-2 px-2 text-sm text-right font-mono">${balance.toFixed(2)}</td>
                    <td className="py-2 px-2">
                      {sel?.selected ? (
                        <MoneyInput
                          value={sel.amount}
                          onChange={(v) => updateBillAmount(b.id, v)}
                        />
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Credits */}
      {filteredCredits.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Available Vendor Credits</h2>
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="w-8" />
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 px-2">Vendor</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 px-2">Credit #</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 px-2">Date</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase pb-2 px-2">Available</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase pb-2 px-2 w-32">Apply</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2 px-2 w-40">Apply To Bill</th>
              </tr>
            </thead>
            <tbody>
              {filteredCredits.map((c) => {
                const sel = creditSelections[c.id];
                const vendorBills = c.contactId ? billsByVendor.get(c.contactId) || [] : [];
                const selectedVendorBills = vendorBills.filter((b) => billSelections[b.id]?.selected);
                return (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 pr-1">
                      <input
                        type="checkbox"
                        checked={!!sel?.selected}
                        onChange={() => toggleCredit(c.id, c.balanceDue || '0', c.contactId)}
                      />
                    </td>
                    <td className="py-2 px-2 text-sm">{c.contactName}</td>
                    <td className="py-2 px-2 text-sm font-mono">{c.txnNumber}</td>
                    <td className="py-2 px-2 text-sm">{c.txnDate}</td>
                    <td className="py-2 px-2 text-sm text-right font-mono">
                      ${parseFloat(c.balanceDue || '0').toFixed(2)}
                    </td>
                    <td className="py-2 px-2">
                      {sel?.selected ? (
                        <MoneyInput value={sel.amount} onChange={(v) => updateCreditAmount(c.id, v)} />
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="py-2 px-2">
                      {sel?.selected ? (
                        <select
                          value={sel.billId}
                          onChange={(e) => updateCreditBill(c.id, e.target.value)}
                          className="block w-full rounded-lg border border-gray-300 px-2 py-1 text-xs"
                        >
                          {selectedVendorBills.map((b) => (
                            <option key={b.id} value={b.id}>{b.txnNumber}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-4">
        <div className="flex justify-end">
          <div className="w-80 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Bills selected ({selectedBillIds.length})</span>
              <span className="font-mono">${totalBills.toFixed(2)}</span>
            </div>
            {totalCredits > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Credits applied ({selectedCreditIds.length})</span>
                <span className="font-mono">-${totalCredits.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Net Payment</span>
              <span className="font-mono">${netPayment.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {payBills.error && <p className="text-sm text-red-600 mb-3">{payBills.error.message}</p>}

      <div className="flex gap-3">
        <Button type="button" onClick={handlePay} disabled={!canSubmit} loading={payBills.isPending}>
          {netPayment === 0 ? 'Apply Credits' : 'Pay Selected'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => navigate('/bills')}>Cancel</Button>
      </div>
    </div>
  );
}
