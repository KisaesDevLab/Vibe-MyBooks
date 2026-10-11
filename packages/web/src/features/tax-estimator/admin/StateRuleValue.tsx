// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import type { StateRuleValueType } from '@kis-books/shared';
import { formatScalar } from './format';

/** Compact one-line text for a state-rule value. */
export function formatStateRuleValue(type: StateRuleValueType, v: unknown): string {
  if (v === null || v === undefined) return 'None';
  switch (type) {
    case 'bool': return v === true ? 'Yes' : 'No';
    case 'money': return formatScalar('money', v);
    case 'rate': return formatScalar('rate', v);
    case 'rate_list': return Array.isArray(v) ? v.map((x) => formatScalar('rate', x)).join(', ') : String(v);
    case 'date_list': return Array.isArray(v) ? (v.length ? v.join(', ') : 'None') : String(v);
    case 'high_agi_rule': {
      const o = v as { threshold: number; pct: number };
      return `AGI over ${formatScalar('money', o.threshold)}: ${formatScalar('rate', o.pct)} of prior year`;
    }
    case 'farmer_rule': {
      const o = v as { ratio: number; current_pct: number; due_date: string; file_by: string };
      return `${formatScalar('rate', o.ratio)} farm income: ${formatScalar('rate', o.current_pct)} by ${o.due_date}, file by ${o.file_by}`;
    }
    default: return String(v);
  }
}

/** Initial editor text for a value of the given type. */
export function stateRuleEditorText(type: StateRuleValueType, v: unknown): string {
  if (v === null || v === undefined) return type === 'enum' ? '' : type === 'bool' ? 'false' : '';
  switch (type) {
    case 'bool': return v === true ? 'true' : 'false';
    case 'date_list': case 'rate_list': return Array.isArray(v) ? v.join(', ') : '';
    case 'high_agi_rule': case 'farmer_rule': return JSON.stringify(v, null, 2);
    default: return String(v);
  }
}

export function StateRuleValue({ type, value }: { type: StateRuleValueType; value: unknown }) {
  return <span className="tabular-nums">{formatStateRuleValue(type, value)}</span>;
}
