// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toaster';
import { useInvoiceTemplate, useUpdateInvoiceTemplate } from '../../api/hooks/useInvoiceTemplate';
import { useCompanySettings, useUpdateCompanySettings } from '../../api/hooks/useCompany';

export function InvoiceTemplateEditor() {
  const { data, isLoading } = useInvoiceTemplate();
  const updateTemplate = useUpdateInvoiceTemplate();
  const { data: settingsData } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();
  const toast = useToast();

  const [accentColor, setAccentColor] = useState('#2563EB');
  const [showShipTo, setShowShipTo] = useState(false);
  const [showPoNumber, setShowPoNumber] = useState(false);
  const [showTerms, setShowTerms] = useState(true);
  const [footerText, setFooterText] = useState('Thank you for your business!');

  // Invoice numbering lives on the company settings, not the template row.
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [invoiceNextNumber, setInvoiceNextNumber] = useState('1001');

  // Hydrate the form once the saved template loads.
  useEffect(() => {
    const t = data?.template;
    if (!t) return;
    setAccentColor(t.accentColor || '#2563EB');
    setShowShipTo(!!t.showShipTo);
    setShowPoNumber(!!t.showPoNumber);
    setShowTerms(!!t.showTerms);
    setFooterText(t.footerText ?? '');
  }, [data]);

  useEffect(() => {
    const s = settingsData?.settings;
    if (!s) return;
    if (s.invoicePrefix != null) setInvoicePrefix(s.invoicePrefix);
    if (s.invoiceNextNumber != null) setInvoiceNextNumber(String(s.invoiceNextNumber));
  }, [settingsData]);

  const saving = isLoading || updateTemplate.isPending || updateSettings.isPending;

  const handleSave = async () => {
    const nextNum = parseInt(invoiceNextNumber, 10);
    if (!Number.isInteger(nextNum) || nextNum < 1) {
      toast.error('Next invoice number must be a whole number of 1 or more');
      return;
    }
    try {
      await Promise.all([
        updateTemplate.mutateAsync({
          accentColor,
          showShipTo,
          showPoNumber,
          showTerms,
          footerText: footerText.trim() === '' ? null : footerText,
        }),
        updateSettings.mutateAsync({
          invoicePrefix: invoicePrefix.trim(),
          invoiceNextNumber: nextNum,
        }),
      ]);
      toast.success('Invoice settings saved');
    } catch (err) {
      toast.error('Could not save invoice settings', { detail: (err as Error).message });
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Invoice Template</h1>
      <div className="max-w-2xl space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Appearance</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Accent Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-10 w-10 rounded cursor-pointer" />
              <input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm w-28 font-mono" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Numbering</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prefix</label>
              <input value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" placeholder="INV-" maxLength={20} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Next Number</label>
              <input value={invoiceNextNumber} onChange={(e) => setInvoiceNextNumber(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" type="number" min="1" step="1" />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            The next invoice will be numbered <span className="font-mono text-gray-700">{invoicePrefix}{invoiceNextNumber || '…'}</span>.
            You can still override the number on any individual invoice.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-3">
          <h2 className="text-lg font-semibold text-gray-800">Fields</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showShipTo} onChange={(e) => setShowShipTo(e.target.checked)} className="rounded border-gray-300" />
            Show Ship To
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showPoNumber} onChange={(e) => setShowPoNumber(e.target.checked)} className="rounded border-gray-300" />
            Show PO Number
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showTerms} onChange={(e) => setShowTerms(e.target.checked)} className="rounded border-gray-300" />
            Show Payment Terms
          </label>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Footer</h2>
          <Input label="Footer Text" value={footerText} onChange={(e) => setFooterText(e.target.value)} />
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {updateTemplate.isPending || updateSettings.isPending ? 'Saving…' : 'Save Template'}
        </Button>
      </div>
    </div>
  );
}
