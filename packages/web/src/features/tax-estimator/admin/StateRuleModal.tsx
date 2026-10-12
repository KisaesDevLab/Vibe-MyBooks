// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import {
  getStateRuleDef, validateStateRuleValue, installmentPairOf, installmentPairError, STATE_INSTALLMENT_PAIRS,
} from '@kis-books/shared';
import type { StateRuleDef, StateRuleRowDTO, StateRuleValueType } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { StateRuleValue, stateRuleEditorText } from './StateRuleValue';

const OBJECT_TYPES: StateRuleValueType[] = ['high_agi_rule', 'farmer_rule'];
const LIST_TYPES: StateRuleValueType[] = ['date_list', 'rate_list', 'rate_schedule'];

/** One `from to rate` leg per line (commas also accepted), e.g. "2025-01-01 2025-12-31 0.08". */
function parseRateSchedule(t: string): { value?: unknown; error?: string } {
  const lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { error: 'Enter at least one "from to rate" line, or tick null' };
  const legs: Array<{ from: string; to: string; rate: number }> = [];
  for (const [i, line] of lines.entries()) {
    const parts = line.split(/[\s,]+/).filter(Boolean);
    const rate = Number(parts[2]);
    if (parts.length !== 3 || Number.isNaN(rate)) return { error: `Line ${i + 1}: expected "YYYY-MM-DD YYYY-MM-DD rate"` };
    legs.push({ from: parts[0]!, to: parts[1]!, rate });
  }
  return { value: legs };
}

/** Parse the editor text into a candidate value, or an error message. */
export function parseStateEditorValue(def: StateRuleDef, text: string, isNull: boolean): { value?: unknown; error?: string } {
  if (isNull) return { value: null };
  const t = text.trim();
  switch (def.type) {
    case 'bool': return { value: t === 'true' };
    case 'money': case 'rate': {
      if (t === '') return { error: 'A value is required' };
      const n = Number(t);
      return Number.isNaN(n) ? { error: 'expected a number' } : { value: n };
    }
    case 'enum': return { value: t };
    case 'date': return t === '' ? { error: 'A date is required' } : { value: t };
    case 'rate_schedule': return parseRateSchedule(t);
    case 'date_list': return { value: t === '' ? [] : t.split(/[\s,]+/).filter(Boolean) };
    case 'rate_list': {
      const parts = t.split(/[\s,]+/).filter(Boolean);
      const nums = parts.map(Number);
      return nums.some(Number.isNaN) ? { error: 'expected numbers separated by commas' } : { value: nums };
    }
    default:
      try { return { value: JSON.parse(t) }; } catch { return { error: 'Invalid JSON' }; }
  }
}

export function validateStateOverride(def: StateRuleDef, text: string, isNull: boolean, reason: string): { value?: unknown; valueError?: string; reasonError?: string } {
  const parsed = parseStateEditorValue(def, text, isNull);
  const valueError = parsed.error ?? validateStateRuleValue(def, parsed.value) ?? undefined;
  const reasonError = reason.trim().length < 3 ? 'A reason of at least 3 characters is required' : undefined;
  return { value: parsed.value, valueError, reasonError };
}

const HINT: Partial<Record<StateRuleValueType, string>> = {
  rate: 'Enter as a decimal fraction (0.9 = 90%).',
  money: 'Enter dollars, e.g. 1000.',
  date_list: 'YYYY-MM-DD dates separated by commas or new lines.',
  rate_list: 'Decimal fractions separated by commas, e.g. 0.25, 0.25, 0.25, 0.25.',
  date: 'One YYYY-MM-DD date.',
  rate_schedule: 'One period per line: from, to, annual rate as a decimal, e.g. 2025-01-01 2025-12-31 0.08. Periods in date order, no overlaps. These rates replace the single penalty rate on the days they cover.',
  high_agi_rule: 'JSON: {"threshold": 150000, "pct": 1.1} plus optional "threshold_mfs", "no_prior_year_agi", "no_prior_year_agi_mfs".',
  farmer_rule: 'JSON: {"ratio": 0.667, "current_pct": 0.667, "due_date": "YYYY-MM-DD", "file_by": "YYYY-MM-DD"} plus optional "treatment": "single_installment" | "quarterly" | "exempt".',
};

export function StateRuleModal({ row, partner, saving, serverError, onSave, onClose }: {
  row: StateRuleRowDTO;
  /** QA D6: the other half of an installment pair (pcts + due dates), edited alongside. */
  partner?: StateRuleRowDTO;
  saving: boolean;
  serverError?: string | null;
  onSave: (value: unknown, reason: string, companion?: { key: string; value: unknown }) => void;
  onClose: () => void;
}) {
  const def = getStateRuleDef(row.key);
  const partnerDef = partner ? getStateRuleDef(partner.key) : undefined;
  const [text, setText] = useState(stateRuleEditorText(row.type, row.value));
  const [isNull, setIsNull] = useState(row.value === null);
  const [partnerText, setPartnerText] = useState(partner ? stateRuleEditorText(partner.type, partner.value) : '');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  if (!def) return null;
  const v = validateStateOverride(def, text, isNull, reason);
  const multiline = OBJECT_TYPES.includes(def.type) || LIST_TYPES.includes(def.type);
  const pair = installmentPairOf(STATE_INSTALLMENT_PAIRS, row.key);
  const partnerParsed = partner && partnerDef ? parseStateEditorValue(partnerDef, partnerText, partner.value === null && partnerText.trim() === '') : undefined;
  const partnerError = partnerParsed ? (partnerParsed.error ?? (partnerDef ? validateStateRuleValue(partnerDef, partnerParsed.value) : null) ?? undefined) : undefined;
  const partnerValue = partnerParsed && !partnerError ? partnerParsed.value : partner?.value;
  const pairError = pair && !v.valueError && !partnerError
    ? installmentPairError(pair, row.key === pair.pcts ? v.value : partnerValue, row.key === pair.pcts ? partnerValue : v.value) ?? undefined
    : undefined;
  const partnerChanged = !!partner && partnerParsed !== undefined && !partnerError && JSON.stringify(partnerParsed.value) !== JSON.stringify(partner.value);

  const submit = () => {
    setSubmitted(true);
    if (v.valueError || v.reasonError || partnerError || pairError) return;
    onSave(v.value, reason.trim(), partnerChanged ? { key: partner!.key, value: partnerParsed!.value } : undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-label={`Override ${row.state} ${row.key}`} className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900">Override {row.label}</h2>
        <p className="text-xs text-gray-500 font-mono mb-3">{row.state} · {row.key}</p>
        <div className="text-sm text-gray-600 mb-3">Current: <StateRuleValue type={row.type} value={row.value} /></div>
        {def.nullable && (
          <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
            <input type="checkbox" checked={isNull} onChange={(e) => setIsNull(e.target.checked)} />
            No such rule in this state (null)
          </label>
        )}
        {!isNull && (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="sr-value">Value ({def.type})</label>
            {def.type === 'bool' ? (
              <select id="sr-value" value={text === 'true' ? 'true' : 'false'} onChange={(e) => setText(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                <option value="true">Yes</option><option value="false">No</option>
              </select>
            ) : def.type === 'enum' ? (
              <select id="sr-value" value={text} onChange={(e) => setText(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {(def.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : multiline ? (
              <textarea id="sr-value" rows={OBJECT_TYPES.includes(def.type) ? 7 : 4} value={text} onChange={(e) => setText(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
            ) : (
              <input id="sr-value" value={text} onChange={(e) => setText(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            )}
            {HINT[def.type] && <p className="text-xs text-gray-500 mt-1">{HINT[def.type]}</p>}
          </>
        )}
        {submitted && v.valueError && <p role="alert" className="text-xs text-red-600 mt-1">{v.valueError}</p>}
        {partner && (
          <>
            <label className="block text-sm font-medium text-gray-700 mt-3 mb-1" htmlFor="sr-partner">{partner.label} ({partner.key}) — saved together</label>
            <textarea id="sr-partner" rows={3} value={partnerText} onChange={(e) => setPartnerText(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" />
            {submitted && partnerError && <p role="alert" className="text-xs text-red-600 mt-1">{partner.key}: {partnerError}</p>}
          </>
        )}
        {pairError && <p role="alert" className="text-xs text-red-600 mt-1" data-testid="pair-error">{pairError}</p>}
        <label className="block text-sm font-medium text-gray-700 mt-4 mb-1" htmlFor="sr-reason">Reason (audited)</label>
        <input id="sr-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
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
