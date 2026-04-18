// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrintQueue, usePrintChecks, useCheckSettings } from '../../api/hooks/useChecks';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { CheckCircle, Printer, AlertTriangle, RotateCcw } from 'lucide-react';

type FlowStep = 'select' | 'rendering' | 'confirm';

export function PrintChecksPage() {
  const navigate = useNavigate();

  const [bankAccountId, setBankAccountId] = useState('');
  const [startingCheckNumber, setStartingCheckNumber] = useState('');
  const [format, setFormat] = useState<'voucher' | 'check_middle'>('voucher');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [flowStep, setFlowStep] = useState<FlowStep>('select');
  const [printedCheckIds, setPrintedCheckIds] = useState<string[]>([]);
  const [printError, setPrintError] = useState('');

  const { data: settingsData } = useCheckSettings();
  const { data, isLoading, isError, refetch } = usePrintQueue(bankAccountId || undefined);
  const printChecks = usePrintChecks();

  const requeueMutation = useMutation({
    mutationFn: (checkIds: string[]) =>
      apiClient('/checks/requeue', { method: 'POST', body: JSON.stringify({ checkIds }) }),
    onSuccess: () => refetch(),
  });

  const items = data?.data || [];
  const effectiveStartNumber = startingCheckNumber || String(settingsData?.settings?.nextCheckNumber || 1);

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const toggleAll = () => {
    setSelected(items.length > 0 && selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)));
  };

  const selectedItems = items.filter((i) => selected.has(i.id));
  const selectedTotal = selectedItems.reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

  const handlePrint = async (e: FormEvent) => {
    e.preventDefault();
    if (selected.size === 0 || !bankAccountId) return;

    const checkIds = Array.from(selected);
    setPrintedCheckIds(checkIds);
    setFlowStep('rendering');
    setPrintError('');

    try {
      // Step 1: Generate and download check PDF
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/v1/checks/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ checkIds, format }),
      });

      if (!res.ok) throw new Error('Failed to render checks');

      const blob = await res.blob();
      const contentType = res.headers.get('Content-Type') || '';

      if (contentType.includes('html')) {
        // Puppeteer not available — open HTML in a new window for browser printing
        const html = await blob.text();
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
        }
      } else {
        // PDF generated — open it
        const url = URL.createObjectURL(blob);
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
          printWindow.focus();
        }
        // Clean up after a delay
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }

      // Step 2: Mark checks as printed in the database
      await printChecks.mutateAsync({
        bankAccountId,
        checkIds,
        startingCheckNumber: Number(effectiveStartNumber),
        format,
      });

      // Step 3: Show confirmation
      setFlowStep('confirm');
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : 'Print failed');
      setFlowStep('select');
    }
  };

  const handleConfirmPrinted = () => {
    // All good — clear and refresh
    setSelected(new Set());
    setPrintedCheckIds([]);
    setFlowStep('select');
    refetch();
  };

  const handleDidNotPrint = async () => {
    // Requeue the checks that didn't print
    await requeueMutation.mutateAsync(printedCheckIds);
    setSelected(new Set());
    setPrintedCheckIds([]);
    setFlowStep('select');
  };

  const formatAmount = (amount: string) => `$${(parseFloat(amount) || 0).toFixed(2)}`;

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Print Checks</h1>

      {printError && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{printError}</span>
          <button
            type="button"
            onClick={() => setPrintError('')}
            className="text-red-500 hover:text-red-700 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handlePrint} className="space-y-6">
        {/* Controls */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="grid grid-cols-3 gap-4">
            <AccountSelector label="Bank Account" value={bankAccountId}
              onChange={(val) => { setBankAccountId(val); setSelected(new Set()); }}
              accountTypeFilter="asset" required />
            <Input label="Starting Check Number" type="number"
              value={startingCheckNumber || String(settingsData?.settings?.nextCheckNumber || '')}
              onChange={(e) => setStartingCheckNumber(e.target.value)} min={1} required />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
              <div className="flex gap-2 mt-1">
                {([
                  { value: 'voucher' as const, label: 'Check on Top' },
                  { value: 'check_middle' as const, label: 'Check in Middle' },
                ]).map((f) => (
                  <button key={f.value} type="button" onClick={() => setFormat(f.value)}
                    className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                      format === f.value ? 'bg-primary-50 border-primary-300 text-primary-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Print Queue Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Checks Queued for Printing</h2>
            {selected.size > 0 && <div className="text-sm font-medium text-primary-700">{selected.size} selected</div>}
          </div>

          {items.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No checks in the print queue.{!bankAccountId && ' Select a bank account to view queued checks.'}
            </div>
          ) : (
            <>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-center w-10">
                      <input type="checkbox" checked={items.length > 0 && selected.size === items.length}
                        onChange={toggleAll} className="rounded" />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payee</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Memo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id} className={`hover:bg-gray-50 cursor-pointer ${selected.has(item.id) ? 'bg-primary-50' : ''}`}
                      onClick={() => toggleSelect(item.id)}>
                      <td className="px-6 py-3 text-center">
                        <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)}
                          onClick={(e) => e.stopPropagation()} className="rounded" />
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-500">{item.txnDate}</td>
                      <td className="px-6 py-3 text-sm text-gray-900">{item.payeeNameOnCheck || item.contactName}</td>
                      <td className="px-6 py-3 text-sm text-gray-900 text-right font-mono">{formatAmount(item.amount)}</td>
                      <td className="px-6 py-3 text-sm text-gray-500">{item.printedMemo || item.memo || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
                <div className="text-sm text-gray-600">{selected.size} of {items.length} checks selected</div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase">Selected Total</p>
                  <p className="text-xl font-mono font-bold text-gray-900">${selectedTotal.toFixed(2)}</p>
                </div>
              </div>
            </>
          )}
        </div>

        {printChecks.error && <p className="text-sm text-red-600">{printChecks.error.message}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/transactions')}>Cancel</Button>
          <Button type="submit" loading={flowStep === 'rendering'} disabled={selected.size === 0 || !bankAccountId}>
            <Printer className="h-4 w-4 mr-2" />
            Print {selected.size > 0 ? `${selected.size} Check${selected.size > 1 ? 's' : ''}` : 'Checks'}
          </Button>
        </div>
      </form>

      {/* Post-Print Confirmation Dialog */}
      {flowStep === 'confirm' && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Did the checks print correctly?</h2>
            <p className="text-sm text-gray-600">
              Check numbers {effectiveStartNumber}–{Number(effectiveStartNumber) + printedCheckIds.length - 1} have been assigned. Verify the printed checks match before confirming.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={handleConfirmPrinted}>
                <CheckCircle className="h-4 w-4 mr-2" /> Yes, all printed correctly
              </Button>
              <Button variant="danger" onClick={handleDidNotPrint} loading={requeueMutation.isPending}>
                <RotateCcw className="h-4 w-4 mr-2" /> No, return to queue
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
