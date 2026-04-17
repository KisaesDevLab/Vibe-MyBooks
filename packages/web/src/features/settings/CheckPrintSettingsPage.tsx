// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect, type FormEvent } from 'react';
import { useCheckSettings, useUpdateCheckSettings } from '../../api/hooks/useChecks';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { validateRoutingNumber } from '@kis-books/shared';
import { Printer } from 'lucide-react';

export function CheckPrintSettingsPage() {
  const { data, isLoading, isError, refetch } = useCheckSettings();
  const updateSettings = useUpdateCheckSettings();

  const [form, setForm] = useState({
    format: 'voucher' as 'voucher' | 'check_middle',
    printOnBlankStock: false,
    bankName: '',
    bankAddress: '',
    routingNumber: '',
    accountNumber: '',
    fractionalRouting: '',
    printCompanyInfo: true,
    printSignatureLine: true,
    printDateLine: true,
    printPayeeLine: true,
    printAmountBox: true,
    printAmountWords: true,
    printMemoLine: true,
    printBankInfo: true,
    printMicrLine: true,
    printCheckNumber: true,
    printVoucherStub: true,
    alignmentOffsetX: 0,
    alignmentOffsetY: 0,
    nextCheckNumber: 1,
    defaultBankAccountId: '',
  });

  const [routingError, setRoutingError] = useState('');

  useEffect(() => {
    if (data?.settings) {
      const s = data.settings;
      setForm({
        format: ((s.format as string) === 'standard' ? 'check_middle' : s.format) || 'voucher',
        printOnBlankStock: s.printOnBlankStock ?? false,
        bankName: s.bankName || '',
        bankAddress: s.bankAddress || '',
        routingNumber: s.routingNumber || '',
        accountNumber: s.accountNumber || '',
        fractionalRouting: s.fractionalRouting || '',
        printCompanyInfo: s.printCompanyInfo ?? true,
        printSignatureLine: s.printSignatureLine ?? true,
        printDateLine: s.printDateLine ?? true,
        printPayeeLine: s.printPayeeLine ?? true,
        printAmountBox: s.printAmountBox ?? true,
        printAmountWords: s.printAmountWords ?? true,
        printMemoLine: s.printMemoLine ?? true,
        printBankInfo: s.printBankInfo ?? true,
        printMicrLine: s.printMicrLine ?? true,
        printCheckNumber: s.printCheckNumber ?? true,
        printVoucherStub: s.printVoucherStub ?? true,
        alignmentOffsetX: s.alignmentOffsetX ?? 0,
        alignmentOffsetY: s.alignmentOffsetY ?? 0,
        nextCheckNumber: s.nextCheckNumber ?? 1,
        defaultBankAccountId: s.defaultBankAccountId || '',
      });
    }
  }, [data]);

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Validate routing number if provided
    if (form.printOnBlankStock && form.routingNumber) {
      if (!validateRoutingNumber(form.routingNumber)) {
        setRoutingError('Invalid routing number. Must be 9 digits with valid checksum.');
        return;
      }
    }
    setRoutingError('');

    updateSettings.mutate({
      format: form.format,
      printOnBlankStock: form.printOnBlankStock,
      bankName: form.bankName,
      bankAddress: form.bankAddress,
      routingNumber: form.routingNumber,
      accountNumber: form.accountNumber,
      fractionalRouting: form.fractionalRouting,
      printCompanyInfo: form.printCompanyInfo,
      printSignatureLine: form.printSignatureLine,
      printDateLine: form.printDateLine,
      printPayeeLine: form.printPayeeLine,
      printAmountBox: form.printAmountBox,
      printAmountWords: form.printAmountWords,
      printMemoLine: form.printMemoLine,
      printBankInfo: form.printBankInfo,
      printMicrLine: form.printMicrLine,
      printCheckNumber: form.printCheckNumber,
      printVoucherStub: form.printVoucherStub,
      alignmentOffsetX: Number(form.alignmentOffsetX),
      alignmentOffsetY: Number(form.alignmentOffsetY),
      nextCheckNumber: Number(form.nextCheckNumber),
      defaultBankAccountId: form.defaultBankAccountId || null,
    });
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Check Print Settings</h1>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {/* Format */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Check Format</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Format</label>
            <div className="flex gap-4">
              {[
                { value: 'voucher', label: 'Check on Top', desc: 'Check on top, voucher stub below' },
                { value: 'check_middle', label: 'Check in Middle', desc: 'Stub on top, check in middle, stub on bottom' },
              ].map((f) => (
                <label key={f.value} className="flex items-start gap-2 cursor-pointer p-3 rounded-lg border border-gray-200 hover:border-primary-300 flex-1">
                  <input
                    type="radio"
                    name="format"
                    value={f.value}
                    checked={form.format === f.value}
                    onChange={() => setForm((prev) => ({ ...prev, format: f.value as any }))}
                    className="text-primary-600 focus:ring-primary-500 mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">{f.label}</span>
                    <p className="text-xs text-gray-500">{f.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Stock Type</label>
            <div className="flex gap-4">
              {[
                { value: false, label: 'Pre-printed' },
                { value: true, label: 'Blank Stock' },
              ].map((opt) => (
                <label key={String(opt.value)} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="stockType"
                    checked={form.printOnBlankStock === opt.value}
                    onChange={() => setForm((prev) => ({ ...prev, printOnBlankStock: opt.value }))}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Pre-printed checks already have bank info. Blank stock requires printing bank details.
            </p>
          </div>
        </div>

        {/* Blank Stock: Bank Details */}
        {form.printOnBlankStock && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Bank Details (Blank Stock)</h2>
            <Input
              label="Bank Name"
              value={form.bankName}
              onChange={set('bankName')}
              placeholder="First National Bank"
            />
            <Input
              label="Bank Address"
              value={form.bankAddress}
              onChange={set('bankAddress')}
              placeholder="123 Main St, Anytown, ST 12345"
            />
            <Input
              label="Routing Number"
              value={form.routingNumber}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, routingNumber: e.target.value }));
                if (routingError) setRoutingError('');
              }}
              maxLength={9}
              placeholder="123456789"
              error={routingError}
            />
            <Input
              label="Account Number"
              value={form.accountNumber}
              onChange={set('accountNumber')}
              placeholder="Account number"
            />
            <Input
              label="Fractional Routing"
              value={form.fractionalRouting}
              onChange={set('fractionalRouting')}
              placeholder="12-34/5678"
            />
          </div>
        )}

        {/* Print Options */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Print Elements</h2>
          <p className="text-xs text-gray-500">
            Turn off elements that are already pre-printed on your check stock. Only the data (payee name, amount, etc.) will be printed in the corresponding position.
          </p>
          {[
            { key: 'printCompanyInfo', label: 'Company name & address', desc: 'Upper left corner of check' },
            { key: 'printCheckNumber', label: 'Check number', desc: 'Upper right corner' },
            { key: 'printDateLine', label: 'Date label & line', desc: '"DATE" label with underline' },
            { key: 'printPayeeLine', label: 'Pay-to-the-order-of line', desc: '"PAY TO THE ORDER OF" label with underline' },
            { key: 'printAmountBox', label: 'Amount box border', desc: 'Box around the dollar amount' },
            { key: 'printAmountWords', label: 'Amount in words line', desc: 'Written amount with "DOLLARS" and underline' },
            { key: 'printMemoLine', label: 'Memo label & line', desc: '"MEMO" label with underline' },
            { key: 'printSignatureLine', label: 'Signature line', desc: '"AUTHORIZED SIGNATURE" with line' },
            ...(form.printOnBlankStock ? [
              { key: 'printBankInfo', label: 'Bank name & address', desc: 'Bank details on the check face' },
              { key: 'printMicrLine', label: 'MICR encoding line', desc: 'Routing, account, and check number at bottom' },
            ] : []),
            { key: 'printVoucherStub', label: 'Voucher stub', desc: 'Detachable stub with check details' },
          ].map((opt) => (
            <label key={opt.key} className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={(form as any)[opt.key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [opt.key]: e.target.checked }))}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">{opt.label}</span>
                <p className="text-xs text-gray-500">{opt.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {/* Alignment */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Alignment</h2>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="X Offset (pixels)"
              type="number"
              value={String(form.alignmentOffsetX)}
              onChange={(e) => setForm((prev) => ({ ...prev, alignmentOffsetX: Number(e.target.value) }))}
            />
            <Input
              label="Y Offset (pixels)"
              type="number"
              value={String(form.alignmentOffsetY)}
              onChange={(e) => setForm((prev) => ({ ...prev, alignmentOffsetY: Number(e.target.value) }))}
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={async () => {
              // Print test page using the actual check rendering engine
              try {
                const token = localStorage.getItem('accessToken');
                // Save settings first so the test uses current values
                await fetch('/api/v1/checks/settings', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify(form),
                });
                // Render a sample check
                const res = await fetch('/api/v1/checks/test-print', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ format: form.format }),
                });
                if (!res.ok) throw new Error('Failed to generate test page');
                const html = await res.text();
                const w = window.open('', '_blank');
                if (w) {
                  w.document.write(html);
                  w.document.close();
                  w.focus();
                  w.print();
                }
              } catch {
                alert('Failed to generate test print');
              }
            }}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print Test Page
          </Button>
        </div>

        {/* Check Numbering */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Check Numbering</h2>
          <Input
            label="Next Check Number"
            type="number"
            value={String(form.nextCheckNumber)}
            onChange={(e) => setForm((prev) => ({ ...prev, nextCheckNumber: Number(e.target.value) }))}
            min={1}
          />
          <AccountSelector
            label="Default Bank Account"
            value={form.defaultBankAccountId}
            onChange={(v) => setForm((prev) => ({ ...prev, defaultBankAccountId: v }))}
            accountTypeFilter="asset"
          />
        </div>

        {/* Status Messages */}
        {updateSettings.error && (
          <p className="text-sm text-red-600">{updateSettings.error.message}</p>
        )}
        {updateSettings.isSuccess && (
          <p className="text-sm text-green-600">Settings saved successfully</p>
        )}

        <Button type="submit" loading={updateSettings.isPending}>
          Save Settings
        </Button>
      </form>
    </div>
  );
}
