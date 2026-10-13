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
    case 'date': return String(v);
    case 'rate_schedule': return Array.isArray(v)
      ? (v as Array<{ from: string; to: string; rate: number }>).map((p) => `${p.from} to ${p.to}: ${formatScalar('rate', p.rate)}`).join('; ')
      : String(v);
    case 'rate_list': return Array.isArray(v) ? v.map((x) => formatScalar('rate', x)).join(', ') : String(v);
    case 'date_list': return Array.isArray(v) ? (v.length ? v.join(', ') : 'None') : String(v);
    case 'high_agi_rule': {
      const o = v as { threshold: number; pct: number; threshold_mfs?: number; no_prior_year_agi?: number; no_prior_year_agi_mfs?: number };
      const mfs = o.threshold_mfs !== undefined ? ` (${formatScalar('money', o.threshold_mfs)} MFS)` : '';
      const none = o.no_prior_year_agi !== undefined
        ? `; no prior-year harbor at current AGI of ${formatScalar('money', o.no_prior_year_agi)}${o.no_prior_year_agi_mfs !== undefined ? ` (${formatScalar('money', o.no_prior_year_agi_mfs)} MFS)` : ''} or more`
        : '';
      return `AGI over ${formatScalar('money', o.threshold)}${mfs}: ${formatScalar('rate', o.pct)} of prior year${none}`;
    }
    case 'farmer_rule': {
      const o = v as { ratio: number; current_pct: number; due_date: string; file_by: string; treatment?: string };
      if (o.treatment === 'exempt') return `${formatScalar('rate', o.ratio)} farm income: exempt from estimates`;
      if (o.treatment === 'quarterly') return `${formatScalar('rate', o.ratio)} farm income: ${formatScalar('rate', o.current_pct)} in the regular installments; no penalty if filed and paid by ${o.file_by}`;
      return `${formatScalar('rate', o.ratio)} farm income: ${formatScalar('rate', o.current_pct)} by ${o.due_date}, file by ${o.file_by}`;
    }
    case 'exemptions': {
      const o = v as { personal_exemption: number | null; dependent_exemption: number | null; personal_credit: number | null; dependent_credit: number | null; personal_exemption_by_status?: Record<string, number>; personal_credit_by_status?: Record<string, number>; simplified?: boolean };
      const m = (n: number | null) => (n == null ? 'not sourced' : formatScalar('money', n));
      const byStatus = (b?: Record<string, number>) => (b ? ` (by status: ${Object.entries(b).map(([k, n]) => `${k} ${formatScalar('money', n)}`).join(', ')})` : '');
      return `Exemption ${m(o.personal_exemption)}/filer${byStatus(o.personal_exemption_by_status)}, ${m(o.dependent_exemption)}/dependent; credit ${m(o.personal_credit)}/filer${byStatus(o.personal_credit_by_status)}, ${m(o.dependent_credit)}/dependent${o.simplified ? ' (simplified)' : ''}`;
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
    case 'rate_schedule': return Array.isArray(v)
      ? (v as Array<{ from: string; to: string; rate: number }>).map((p) => `${p.from} ${p.to} ${p.rate}`).join('\n')
      : '';
    case 'high_agi_rule': case 'farmer_rule': case 'exemptions': return JSON.stringify(v, null, 2);
    default: return String(v);
  }
}

export function StateRuleValue({ type, value }: { type: StateRuleValueType; value: unknown }) {
  return <span className="tabular-nums">{formatStateRuleValue(type, value)}</span>;
}
