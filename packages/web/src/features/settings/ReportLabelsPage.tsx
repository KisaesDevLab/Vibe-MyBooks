import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle, Loader2, RotateCcw } from 'lucide-react';
import { DEFAULT_PL_LABELS, type PLSectionLabels } from '@kis-books/shared';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

type LabelField = keyof PLSectionLabels;

const FIELD_ORDER: Array<{ key: LabelField; helper: string }> = [
  { key: 'revenue', helper: 'Top-line sales/income section' },
  { key: 'cogs', helper: 'Direct costs of producing revenue (only shown when COGS accounts exist)' },
  { key: 'grossProfit', helper: 'Subtotal: Revenue − COGS' },
  { key: 'expenses', helper: 'Operating expenses section' },
  { key: 'operatingIncome', helper: 'Subtotal: Gross Profit − Operating Expenses' },
  { key: 'otherRevenue', helper: 'Non-operating income (interest earned, gains) — only shown when such accounts exist' },
  { key: 'otherExpenses', helper: 'Non-operating expense (interest paid, losses) — only shown when such accounts exist' },
  { key: 'netIncome', helper: 'Final bottom-line total' },
];

interface ApiResponse {
  plLabels: Partial<PLSectionLabels>;
  resolvedPLLabels: PLSectionLabels;
}

export function ReportLabelsPage() {
  const [form, setForm] = useState<PLSectionLabels>(DEFAULT_PL_LABELS);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await apiClient<ApiResponse>('/tenant-settings/report');
        setForm(data.resolvedPLLabels);
      } catch {
        // defaults are fine
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setField = (key: LabelField) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const resetField = (key: LabelField) =>
    setForm((f) => ({ ...f, [key]: DEFAULT_PL_LABELS[key] }));

  const resetAll = () => setForm(DEFAULT_PL_LABELS);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    setSaveError('');
    try {
      // Only send fields that differ from defaults so clearing a field
      // in the UI reverts that heading instead of being stored as empty.
      const plLabels: Partial<PLSectionLabels> = {};
      for (const key of Object.keys(DEFAULT_PL_LABELS) as LabelField[]) {
        const value = form[key]?.trim() || '';
        if (value && value !== DEFAULT_PL_LABELS[key]) {
          plLabels[key] = value;
        }
      }
      await apiClient('/tenant-settings/report', {
        method: 'PUT',
        body: JSON.stringify({ plLabels }),
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveError(err.message || 'Failed to save');
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">P&amp;L Section Headings</h1>
      <p className="text-sm text-gray-500 mb-6">
        Rename the headings that appear on your Profit &amp; Loss report. These changes
        apply to the on-screen view, CSV exports, and PDF exports. Leave any field
        blank (or click <span className="inline-flex items-center gap-1"><RotateCcw className="h-3 w-3" />Reset</span>)
        to restore the default label.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        {FIELD_ORDER.map(({ key, helper }) => {
          const defaultValue = DEFAULT_PL_LABELS[key];
          const isCustom = form[key] !== defaultValue;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">{defaultValue}</label>
                {isCustom && (
                  <button
                    type="button"
                    onClick={() => resetField(key)}
                    className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset
                  </button>
                )}
              </div>
              <Input
                value={form[key]}
                onChange={setField(key)}
                maxLength={80}
                placeholder={defaultValue}
              />
              <p className="text-xs text-gray-500 mt-1">{helper}</p>
            </div>
          );
        })}

        <div className="flex items-center gap-3 pt-2 border-t">
          <Button type="submit" disabled={saveStatus === 'saving'}>
            {saveStatus === 'saving' ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Saving…</> : 'Save'}
          </Button>
          <Button type="button" variant="secondary" onClick={resetAll} disabled={saveStatus === 'saving'}>
            Reset all to defaults
          </Button>
          {saveStatus === 'saved' && (
            <span className="text-sm text-green-700 inline-flex items-center gap-1">
              <CheckCircle className="h-4 w-4" /> Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm text-red-600">{saveError}</span>
          )}
        </div>
      </form>
    </div>
  );
}
