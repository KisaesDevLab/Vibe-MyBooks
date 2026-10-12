// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { validateParameterValue, installmentPairOf, installmentPairError, FEDERAL_INSTALLMENT_PAIRS } from '@kis-books/shared';
import type { ParameterValueType, TaxParameterRowDTO } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { ParameterValue } from './ParameterValue';

const SCALAR: ParameterValueType[] = ['money', 'rate', 'int', 'date', 'month_day'];
const NUMERIC: ParameterValueType[] = ['money', 'rate', 'int'];

const initialText = (row: TaxParameterRowDTO) =>
  SCALAR.includes(row.type) ? String(row.value ?? '') : JSON.stringify(row.value, null, 2);

/** Parse the editor text into a candidate value, or an error message. */
export function parseEditorValue(type: ParameterValueType, text: string): { value?: unknown; error?: string } {
  const t = text.trim();
  if (NUMERIC.includes(type)) {
    if (t === '') return { error: 'A value is required' };
    const n = Number(t);
    return Number.isNaN(n) ? { error: 'expected a number' } : { value: n };
  }
  if (SCALAR.includes(type)) return { value: t };
  try { return { value: JSON.parse(t) }; } catch { return { error: 'Invalid JSON' }; }
}

export function validateOverride(type: ParameterValueType, text: string, reason: string): { value?: unknown; valueError?: string; reasonError?: string } {
  const parsed = parseEditorValue(type, text);
  const valueError = parsed.error ?? validateParameterValue(type, parsed.value) ?? undefined;
  const reasonError = reason.trim().length < 3 ? 'A reason of at least 3 characters is required' : undefined;
  return { value: parsed.value, valueError, reasonError };
}

const HINT: Partial<Record<ParameterValueType, string>> = {
  rate: 'Enter as a decimal fraction (0.9235 = 92.35%).',
  money: 'Enter dollars, e.g. 176100.',
  date: 'YYYY-MM-DD', month_day: 'MM-DD',
  bracket_table: 'JSON: [[upperBound, rate], ..., [null, rate]]',
  rate_period_list: 'JSON: [{"from":"YYYY-MM-DD","to":"YYYY-MM-DD","rate":0.07}]',
};

export function OverrideModal({ row, partner, saving, serverError, onSave, onClose }: {
  row: TaxParameterRowDTO;
  /** QA D6: the other half of an installment pair, edited alongside. */
  partner?: TaxParameterRowDTO;
  saving: boolean;
  serverError?: string | null;
  onSave: (value: unknown, reason: string, companion?: { key: string; value: unknown }) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialText(row));
  const [partnerText, setPartnerText] = useState(partner ? initialText(partner) : '');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const v = validateOverride(row.type, text, reason);
  const multiline = !SCALAR.includes(row.type);
  const pair = installmentPairOf(FEDERAL_INSTALLMENT_PAIRS, row.key);
  const pp = partner ? parseEditorValue(partner.type, partnerText) : undefined;
  const partnerError = pp && partner ? (pp.error ?? validateParameterValue(partner.type, pp.value) ?? undefined) : undefined;
  const partnerValue = pp && !partnerError ? pp.value : partner?.value;
  const pairError = pair && !v.valueError && !partnerError
    ? installmentPairError(pair, row.key === pair.pcts ? v.value : partnerValue, row.key === pair.pcts ? partnerValue : v.value) ?? undefined
    : undefined;
  const partnerChanged = !!partner && !!pp && !partnerError && JSON.stringify(pp.value) !== JSON.stringify(partner.value);

  const submit = () => {
    setSubmitted(true);
    if (v.valueError || v.reasonError || partnerError || pairError) return;
    onSave(v.value, reason.trim(), partnerChanged ? { key: partner!.key, value: pp!.value } : undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-label={`Override ${row.key}`} className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900">Override {row.label}</h2>
        <p className="text-xs text-gray-500 font-mono mb-3">{row.key}</p>
        <div className="text-sm text-gray-600 mb-3">
          Current: <ParameterValue type={row.type} value={row.value} />
        </div>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="tp-value">Value ({row.type})</label>
        {multiline ? (
          <textarea id="tp-value" rows={8} value={text} onChange={(e) => setText(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
        ) : (
          <input id="tp-value" value={text} onChange={(e) => setText(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        )}
        {HINT[row.type] && <p className="text-xs text-gray-500 mt-1">{HINT[row.type]}</p>}
        {row.type.endsWith('_list') && <p className="text-xs text-gray-500 mt-1">Enter a JSON array, e.g. [1, 2, 3].</p>}
        {submitted && v.valueError && <p role="alert" className="text-xs text-red-600 mt-1">{v.valueError}</p>}
        {partner && (
          <>
            <label className="block text-sm font-medium text-gray-700 mt-3 mb-1" htmlFor="tp-partner">{partner.label} ({partner.key}) — saved together</label>
            <textarea id="tp-partner" rows={3} value={partnerText} onChange={(e) => setPartnerText(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
            {submitted && partnerError && <p role="alert" className="text-xs text-red-600 mt-1">{partner.key}: {partnerError}</p>}
          </>
        )}
        {pairError && <p role="alert" className="text-xs text-red-600 mt-1" data-testid="pair-error">{pairError}</p>}
        <label className="block text-sm font-medium text-gray-700 mt-4 mb-1" htmlFor="tp-reason">Reason (audited)</label>
        <input id="tp-reason" value={reason} onChange={(e) => setReason(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        {submitted && v.reasonError && <p role="alert" className="text-xs text-red-600 mt-1">{v.reasonError}</p>}
        {serverError && <p role="alert" className="text-xs text-red-600 mt-2">{serverError}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving}>Save override</Button>
        </div>
      </div>
    </div>
  );
}
