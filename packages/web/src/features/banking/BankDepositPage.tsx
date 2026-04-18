// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.


import { todayLocalISO } from '../../utils/date';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePendingDeposits } from '../../api/hooks/usePayments';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { DatePicker } from '../../components/forms/DatePicker';
import { AccountSelector } from '../../components/forms/AccountSelector';
import type { PendingDepositItem } from '@kis-books/shared';

export function BankDepositPage() {
  const navigate = useNavigate();
  const today = todayLocalISO();

  const [depositToAccountId, setDepositToAccountId] = useState('');
  const [txnDate, setTxnDate] = useState(today);
  const [memo, setMemo] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = usePendingDeposits();
  const items = data?.items || [];

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.transactionId)));
    }
  };

  const selectedItems = items.filter((i) => selected.has(i.transactionId));
  const selectedTotal = selectedItems.reduce((sum, i) => sum + i.amount, 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (selected.size === 0 || !depositToAccountId) return;

    setSaving(true);
    setSaveError(null);

    try {
      // Get Payments Clearing account ID - we need it for the credit side of each line
      // Use the first selected item to find the account via a simple approach:
      // The deposit API (txnType=deposit) expects lines with accountId (the "from" accounts)
      // For pending deposits, we send each payment amount as a line from Payments Clearing
      const pcResponse = await apiClient<{ data: Array<{ id: string; systemTag: string | null }> }>('/accounts?limit=200');
      const pcAccount = pcResponse.data.find((a) => a.systemTag === 'payments_clearing');
      const pcAccountId = pcAccount?.id || depositToAccountId;

      await apiClient('/transactions', {
        method: 'POST',
        body: JSON.stringify({
          txnType: 'deposit',
          txnDate,
          depositToAccountId,
          memo: memo || undefined,
          lines: selectedItems.map((item) => ({
            accountId: pcAccountId,
            amount: item.amount.toFixed(4),
            description: item.customerName || 'Payment',
          })),
        }),
      });
      navigate('/banking');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create deposit');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;

  const formatAmount = (amount: number) => `$${amount.toFixed(2)}`;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Bank Deposit</h1>

      <form onSubmit={handleSubmit} className="max-w-5xl space-y-6">
        {/* Deposit details */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="grid grid-cols-3 gap-4">
            <AccountSelector
              label="Deposit To"
              value={depositToAccountId}
              onChange={setDepositToAccountId}
              accountTypeFilter="asset"
              required
            />
            <DatePicker
              label="Date"
              value={txnDate}
              onChange={(e) => setTxnDate(e.target.value)}
              required
            />
            <Input
              label="Memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>
        </div>

        {/* Pending payments table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Select Payments to Deposit</h2>
            {selected.size > 0 && (
              <div className="text-sm font-medium text-primary-700">
                {selected.size} selected
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No pending payments to deposit.
            </div>
          ) : (
            <>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-center w-10">
                      <input
                        type="checkbox"
                        checked={items.length > 0 && selected.size === items.length}
                        onChange={toggleAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref #</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr
                      key={item.transactionId}
                      className={`hover:bg-gray-50 cursor-pointer ${selected.has(item.transactionId) ? 'bg-primary-50' : ''}`}
                      onClick={() => toggleSelect(item.transactionId)}
                    >
                      <td className="px-6 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(item.transactionId)}
                          onChange={() => toggleSelect(item.transactionId)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded"
                        />
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500">{item.date}</td>
                      <td className="px-6 py-3 text-sm text-gray-500 capitalize">{item.txnType.replace('_', ' ')}</td>
                      <td className="px-6 py-3 text-sm text-gray-900">{item.customerName || '--'}</td>
                      <td className="px-6 py-3 text-sm text-gray-500">{item.refNo || '--'}</td>
                      <td className="px-6 py-3 text-sm text-gray-900 text-right font-mono">{formatAmount(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Selected total */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase">Selected Total</p>
                  <p className="text-xl font-mono font-bold text-gray-900">{formatAmount(selectedTotal)}</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Error and submit */}
        {saveError && <p className="text-sm text-red-600">{saveError}</p>}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/banking')}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={saving}
            disabled={selected.size === 0 || !depositToAccountId}
          >
            Save Deposit
          </Button>
        </div>
      </form>
    </div>
  );
}
