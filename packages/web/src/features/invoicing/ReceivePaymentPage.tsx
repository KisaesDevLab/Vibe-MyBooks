// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.


import { todayLocalISO } from '../../utils/date';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReceivePayment, useOpenInvoices, type OpenInvoice } from '../../api/hooks/usePayments';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { DatePicker } from '../../components/forms/DatePicker';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { ContactSelector } from '../../components/forms/ContactSelector';
import { MoneyInput } from '../../components/forms/MoneyInput';

interface InvoicePaymentRow {
  invoiceId: string;
  invoice: OpenInvoice;
  checked: boolean;
  payment: string;
}

export function ReceivePaymentPage() {
  const navigate = useNavigate();
  const today = todayLocalISO();

  const [customerId, setCustomerId] = useState('');
  const [txnDate, setTxnDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [depositToAccountId, setDepositToAccountId] = useState('');
  const [refNo, setRefNo] = useState('');
  const [memo, setMemo] = useState('');
  const [rows, setRows] = useState<InvoicePaymentRow[]>([]);

  const { data: openInvoicesData, isLoading: loadingInvoices } = useOpenInvoices(customerId);
  const receivePayment = useReceivePayment();

  // When open invoices load, build rows
  const invoices = openInvoicesData?.invoices || [];
  if (invoices.length > 0 && rows.length === 0 && customerId) {
    const newRows = invoices.map((inv) => ({
      invoiceId: inv.id,
      invoice: inv,
      checked: false,
      payment: '',
    }));
    setRows(newRows);
  }

  // Reset rows when customer changes
  const handleCustomerChange = (id: string) => {
    setCustomerId(id);
    setRows([]);
  };

  const handleCheckRow = (idx: number, checked: boolean) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              checked,
              payment: checked ? parseFloat(r.invoice.balanceDue).toFixed(2) : '',
            }
          : r,
      ),
    );
  };

  const handlePaymentChange = (idx: number, value: string) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, payment: value, checked: parseFloat(value) > 0 } : r,
      ),
    );
  };

  const totalApplied = rows.reduce((sum, r) => sum + (parseFloat(r.payment) || 0), 0);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    const applications = rows
      .filter((r) => parseFloat(r.payment) > 0)
      .map((r) => ({
        invoiceId: r.invoiceId,
        amount: r.payment,
      }));

    receivePayment.mutate(
      {
        customerId,
        date: txnDate,
        amount: amount || totalApplied.toFixed(2),
        depositTo: depositToAccountId,
        refNo: refNo || undefined,
        memo: memo || undefined,
        applications,
      },
      { onSuccess: () => navigate('/invoices') },
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Receive Payment</h1>

      <form onSubmit={handleSubmit} className="max-w-5xl space-y-6">
        {/* Payment details */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <ContactSelector
            label="Customer"
            value={customerId}
            onChange={handleCustomerChange}
            contactTypeFilter="customer"
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DatePicker
              label="Payment Date"
              value={txnDate}
              onChange={(e) => setTxnDate(e.target.value)}
              required
            />
            <MoneyInput
              label="Amount Received"
              value={amount}
              onChange={setAmount}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <AccountSelector
              label="Deposit To"
              value={depositToAccountId}
              onChange={setDepositToAccountId}
              accountTypeFilter="asset"
              required
            />
            <Input
              label="Ref #"
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
            />
            <Input
              label="Memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>
        </div>

        {/* Open invoices */}
        {customerId && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700">Outstanding Invoices</h2>
            </div>

            {loadingInvoices ? (
              <LoadingSpinner className="py-8" />
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                No open invoices for this customer.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                <table className="min-w-[720px] divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-center w-10">
                        <input
                          type="checkbox"
                          checked={rows.length > 0 && rows.every((r) => r.checked)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setRows((prev) =>
                              prev.map((r) => ({
                                ...r,
                                checked,
                                payment: checked ? parseFloat(r.invoice.balanceDue).toFixed(2) : '',
                              })),
                            );
                          }}
                          className="rounded"
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount Due</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rows.map((row, idx) => (
                      <tr key={row.invoiceId} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.checked}
                            onChange={(e) => handleCheckRow(idx, e.target.checked)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-6 py-3 text-sm font-medium text-gray-900">{row.invoice.invoiceNumber}</td>
                        <td className="px-6 py-3 text-sm text-gray-500">{row.invoice.txnDate}</td>
                        <td className="px-6 py-3 text-sm text-gray-500">{row.invoice.dueDate || '--'}</td>
                        <td className="px-6 py-3 text-sm text-gray-900 text-right font-mono">
                          ${parseFloat(row.invoice.balanceDue).toFixed(2)}
                        </td>
                        <td className="px-6 py-3 text-right w-40">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={row.invoice.balanceDue}
                            value={row.payment}
                            onChange={(e) => handlePaymentChange(idx, e.target.value)}
                            className="block w-full rounded border border-gray-300 px-2 py-1 text-sm text-right font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                  <div className="text-sm">
                    <span className="text-gray-600">Total Applied: </span>
                    <span className="font-mono font-semibold text-gray-900">${totalApplied.toFixed(2)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Error and submit */}
        {receivePayment.error && (
          <p className="text-sm text-red-600">{receivePayment.error.message}</p>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/invoices')}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={receivePayment.isPending}
            disabled={!customerId || !depositToAccountId || totalApplied <= 0}
          >
            Save Payment
          </Button>
        </div>
      </form>
    </div>
  );
}
