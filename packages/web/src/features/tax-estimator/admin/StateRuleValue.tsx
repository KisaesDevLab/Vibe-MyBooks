// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

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
    // Q53: rate schedules, standard deduction, capital gains, federal tax deduction, WA excise.
    case 'brackets': {
      const o = v as Record<string, unknown>;
      const alt = Array.isArray(o['schedules_by_income']) ? `; ${(o['schedules_by_income'] as unknown[]).length} alternative schedules by income` : '';
      return `${STATUS_ORDER.map((fs) => `${fs.toUpperCase()} ${bracketText(o[fs])}`).join(' | ')}${alt}${o['simplified'] ? ' (simplified)' : ''}`;
    }
    case 'standard_deduction': {
      const o = v as Record<string, unknown>;
      return `${STATUS_ORDER.map((fs) => `${fs.toUpperCase()} ${formatScalar('money', o[fs])}`).join(', ')}${o['simplified'] ? ' (simplified)' : ''}`;
    }
    case 'capital_gains': {
      const o = v as { treatment: string; applies_to?: string; exclusion_tiers?: Array<{ over: number; pct: number }> | null; exclusion_min?: number | null; exclusion_cap?: number | null; max_rate?: number | null; stcg_rate?: number | null; ltcg_brackets?: unknown; surtax_rate?: number | null; surtax_agi_over?: number | null; includes_qualified_dividends?: boolean; simplified?: boolean };
      const on = o.applies_to === 'net_capital_gain' ? 'net capital gain' : 'net long-term gain';
      const parts: string[] = [o.treatment.replace(/_/g, ' ')];
      if (o.exclusion_tiers?.length) parts.push(`${o.exclusion_tiers.map((t) => `${formatScalar('rate', t.pct)} excluded over ${formatScalar('money', t.over)}`).join(', ')} of ${on}`);
      if (o.exclusion_min != null) parts.push(`at least ${formatScalar('money', o.exclusion_min)}`);
      if (o.exclusion_cap != null) parts.push(`at most ${formatScalar('money', o.exclusion_cap)}`);
      if (o.max_rate != null) parts.push(`max rate ${formatScalar('rate', o.max_rate)} on ${on}`);
      if (o.stcg_rate != null) parts.push(`short-term ${formatScalar('rate', o.stcg_rate)}`);
      if (o.ltcg_brackets) parts.push('long-term schedule');
      if (o.surtax_rate != null) parts.push(`surtax ${formatScalar('rate', o.surtax_rate)} over federal AGI ${formatScalar('money', o.surtax_agi_over)}`);
      if (o.includes_qualified_dividends) parts.push('incl. qualified dividends');
      return `${parts.join('; ')}${o.simplified ? ' (simplified)' : ''}`;
    }
    case 'federal_tax_deduction': {
      const o = v as { tiers: Array<{ agi_over: number; pct: number; cap?: Record<string, number> | null }> };
      return o.tiers.map((t) => `AGI over ${formatScalar('money', t.agi_over)}: ${formatScalar('rate', t.pct)}${t.cap ? ` (cap ${formatScalar('money', t.cap['single'])} single / ${formatScalar('money', t.cap['mfj'])} MFJ)` : ', no cap'}`).join('; ');
    }
    case 'capital_gains_excise': {
      const o = v as { standard_deduction: number; brackets: unknown; estimates_required?: boolean };
      return `Long-term gain over ${formatScalar('money', o.standard_deduction)}: ${bracketText(o.brackets)}${o.estimates_required === false ? '; no estimates' : ''}`;
    }
    default: return String(v);
  }
}

const STATUS_ORDER = ['single', 'mfj', 'mfs', 'hoh', 'qss'] as const;

function bracketText(list: unknown): string {
  if (!Array.isArray(list)) return '—';
  return (list as Array<{ over: number; rate: number; add?: number }>).map((b) => `${formatScalar('rate', b.rate)} over ${formatScalar('money', b.over)}${b.add ? ` + ${formatScalar('money', b.add)}` : ''}`).join(', ');
}

/** Q53: a bracket table (one row per filing status) for the `brackets` value; other types use the one-line text. */
function BracketTable({ value }: { value: Record<string, unknown> }) {
  const alts = Array.isArray(value['schedules_by_income']) ? (value['schedules_by_income'] as Array<Record<string, unknown>>) : [];
  const table = (o: Record<string, unknown>, caption: string) => (
    <table className="text-xs border-collapse" aria-label={caption}>
      <caption className="text-left text-gray-500">{caption}</caption>
      <tbody>
        {STATUS_ORDER.map((fs) => (
          <tr key={fs}>
            <th scope="row" className="pr-2 text-left font-medium text-gray-600">{fs.toUpperCase()}</th>
            <td className="tabular-nums">{bracketText(o[fs])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <div className="space-y-1">
      {table(value, 'Rate schedule (rate over taxable income)')}
      {alts.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-gray-600">{alts.length} alternative schedules by state taxable income</summary>
          {alts.map((a, i) => <div key={i}>{table(a, `Taxable income over ${formatScalar('money', a['income_over'])}`)}</div>)}
        </details>
      )}
      {value['simplified'] === true && <div className="text-xs text-amber-700">Simplified{typeof value['note'] === 'string' ? `: ${value['note']}` : ''}</div>}
    </div>
  );
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
    case 'high_agi_rule': case 'farmer_rule': case 'exemptions':
    case 'brackets': case 'standard_deduction': case 'capital_gains': case 'federal_tax_deduction': case 'capital_gains_excise':
      return JSON.stringify(v, null, 2);
    default: return String(v);
  }
}

export function StateRuleValue({ type, value }: { type: StateRuleValueType; value: unknown }) {
  if (type === 'brackets' && value && typeof value === 'object' && !Array.isArray(value)) return <BracketTable value={value as Record<string, unknown>} />;
  return <span className="tabular-nums">{formatStateRuleValue(type, value)}</span>;
}
