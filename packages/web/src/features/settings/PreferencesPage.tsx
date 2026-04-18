// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect, type FormEvent } from 'react';
import { useCompanySettings, useUpdateCompanySettings } from '../../api/hooks/useCompany';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { accountingMethods, paymentTerms, categoryFilterModes } from '@kis-books/shared';
import type { AccountingMethod, PaymentTerms as PaymentTermsType, CategoryFilterMode } from '@kis-books/shared';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function PreferencesPage() {
  const { data, isLoading, isError, refetch } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();

  const [form, setForm] = useState({
    fiscalYearStartMonth: 1,
    accountingMethod: 'accrual',
    defaultPaymentTerms: 'net_30',
    invoicePrefix: 'INV-',
    invoiceNextNumber: 1001,
    defaultSalesTaxRate: '0',
    currency: 'USD',
    dateFormat: 'MM/DD/YYYY',
    categoryFilterMode: 'by_type',
    defaultLineEntryMode: 'category',
    lockDate: '',
    chatSupportEnabled: false,
  });

  useEffect(() => {
    if (data?.settings) {
      setForm({
        fiscalYearStartMonth: data.settings.fiscalYearStartMonth ?? 1,
        accountingMethod: data.settings.accountingMethod ?? 'accrual',
        defaultPaymentTerms: data.settings.defaultPaymentTerms ?? 'net_30',
        invoicePrefix: data.settings.invoicePrefix ?? 'INV-',
        invoiceNextNumber: data.settings.invoiceNextNumber ?? 1001,
        defaultSalesTaxRate: data.settings.defaultSalesTaxRate ?? '0',
        currency: data.settings.currency ?? 'USD',
        dateFormat: data.settings.dateFormat ?? 'MM/DD/YYYY',
        categoryFilterMode: data.settings.categoryFilterMode ?? 'by_type',
        defaultLineEntryMode: data.settings.defaultLineEntryMode ?? 'category',
        lockDate: data.settings.lockDate ?? '',
        chatSupportEnabled: data.settings.chatSupportEnabled ?? false,
      });
    }
  }, [data]);

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateSettings.mutate({
      ...form,
      accountingMethod: form.accountingMethod as AccountingMethod,
      defaultPaymentTerms: form.defaultPaymentTerms as PaymentTermsType,
      categoryFilterMode: form.categoryFilterMode as CategoryFilterMode,
      defaultLineEntryMode: form.defaultLineEntryMode as 'category' | 'item',
      fiscalYearStartMonth: Number(form.fiscalYearStartMonth),
      invoiceNextNumber: Number(form.invoiceNextNumber),
      lockDate: form.lockDate || null,
    });
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Preferences</h1>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Accounting</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year Start</label>
            <select value={form.fiscalYearStartMonth} onChange={set('fiscalYearStartMonth')} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Accounting Method</label>
            <select value={form.accountingMethod} onChange={set('accountingMethod')} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {accountingMethods.map((m) => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
            </select>
          </div>
          <Input label="Default Sales Tax Rate" value={form.defaultSalesTaxRate} onChange={set('defaultSalesTaxRate')} placeholder="0.0825" />
          <Input label="Currency" value={form.currency} onChange={set('currency')} maxLength={3} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category List in Transactions</label>
            <select value={form.categoryFilterMode} onChange={set('categoryFilterMode')} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="by_type">Filter by transaction type (show only relevant categories)</option>
              <option value="all">Show all categories</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              "Filter by type" shows only expense accounts for expenses, revenue accounts for sales, etc. "Show all" displays every account in every dropdown.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Invoice Line Entry Mode</label>
            <select value={form.defaultLineEntryMode} onChange={set('defaultLineEntryMode')} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="category">Category (select revenue account manually)</option>
              <option value="item">Item (select from items catalog)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Controls whether new invoice lines default to account selection or item selection. Can be overridden per line.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Closing & Lock</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lock Date</label>
            <input
              type="date"
              value={form.lockDate}
              onChange={set('lockDate')}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">
              Transactions on or before this date cannot be created, edited, or voided. Set this to the last day of your most recently completed fiscal year to protect closed books. Leave blank to allow edits to all dates.
            </p>
          </div>
          {form.lockDate && (
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, lockDate: '' }))}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Clear lock date
            </button>
          )}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800">
            Year-end closing is handled automatically. Revenue and expense accounts reset each fiscal year in the Profit & Loss report, and net income flows into Retained Earnings on the Balance Sheet. No manual closing entries are needed.
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Invoicing</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Payment Terms</label>
            <select value={form.defaultPaymentTerms} onChange={set('defaultPaymentTerms')} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {paymentTerms.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>)}
            </select>
          </div>
          <Input label="Invoice Prefix" value={form.invoicePrefix} onChange={set('invoicePrefix')} />
          <Input label="Next Invoice Number" value={String(form.invoiceNextNumber)} onChange={set('invoiceNextNumber')} type="number" />
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">AI Chat Assistant</h2>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.chatSupportEnabled}
              onChange={(e) => setForm((f) => ({ ...f, chatSupportEnabled: e.target.checked }))}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 h-5 w-5 mt-0.5"
            />
            <div>
              <span className="text-sm font-medium text-gray-700">Enable chat assistant for this company</span>
              <p className="text-xs text-gray-500 mt-1">
                Adds a slide-out AI chat panel to every screen for users in this company. The
                assistant can answer questions about Vibe MyBooks, explain accounting concepts,
                and read your current screen context. Requires a system administrator to also
                enable AI processing and chat support at the system level.
              </p>
            </div>
          </label>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Display</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
            <select value={form.dateFormat} onChange={set('dateFormat')} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </select>
          </div>
        </div>

        {updateSettings.error && <p className="text-sm text-red-600">{updateSettings.error.message}</p>}
        {updateSettings.isSuccess && <p className="text-sm text-green-600">Saved successfully</p>}

        <Button type="submit" loading={updateSettings.isPending}>Save Preferences</Button>
      </form>
    </div>
  );
}
