import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export function InvoiceTemplateEditor() {
  const [accentColor, setAccentColor] = useState('#2563EB');
  const [showShipTo, setShowShipTo] = useState(false);
  const [showPoNumber, setShowPoNumber] = useState(false);
  const [showTerms, setShowTerms] = useState(true);
  const [footerText, setFooterText] = useState('Thank you for your business!');

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

        <Button>Save Template</Button>
      </div>
    </div>
  );
}
