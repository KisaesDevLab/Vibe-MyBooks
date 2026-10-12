// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Pure builder for the Calculation table: reads the EstimateResultDTO and returns display lines.
// YTD tax basis is filled only for income lines (the engine computes tax on the projection only,
// so the YTD column is blank for deduction and tax lines).
import type { EstimateResultDTO } from '@kis-books/shared';
import { num, pct } from './format';

export type TraceScope =
  | { kind: 'federal'; steps: string[]; idPrefix?: string }
  | { kind: 'state'; state?: string }
  | { kind: 'estimate'; jurisdiction: string };

export interface CalcLine {
  key: string;
  label: string;
  sub?: string;
  ytd?: string | null;
  projected: string | null;
  bold?: boolean;
  chips?: Array<{ text: string; tone: 'warn' | 'info' }>;
  trace?: TraceScope;
}
export interface CalcSection { key: string; title: string; lines: CalcLine[] }

const ENTITY_LABEL: Record<string, string> = {
  sole_prop: 'Sch C', single_member_llc: 'Sch C', s_corp: 'S corp', partnership: 'Partnership', c_corp: 'C corp', farm: 'Sch F', rental: 'Rental',
};
const nonZero = (v: unknown) => Math.abs(num(v)) > 0;
const sum = (o: Record<string, string>) => Object.values(o).reduce((a, v) => a + num(v), 0);

export function buildCalcSections(r: EstimateResultDTO): CalcSection[] {
  const f = r.federal;
  const sections: CalcSection[] = [];

  const income: CalcLine[] = f.entities.map((e) => {
    const shares = e.shares;
    const activity = [...new Set(shares.map((s) => s.activityType))].join(', ');
    return {
      key: `inc.${e.companyId}`, label: e.companyName,
      sub: [ENTITY_LABEL[e.entityType] ?? e.entityType, activity].filter(Boolean).join(' · '),
      ytd: String(sum(e.ytd as unknown as Record<string, string>)), projected: e.projectedProfit,
      trace: { kind: 'federal', steps: ['entity_income', 'allocation'], idPrefix: undefined },
    } satisfies CalcLine;
  });
  const otherIncome: Array<[string, string, string]> = [
    ['wages', 'W-2 wages', f.income.wages], ['int', 'Interest', f.income.interest], ['div', 'Dividends', f.income.dividends],
    ['cg', 'Net capital gain', f.income.capitalGainNet], ['s1231', 'Net section 1231', f.income.section1231], ['oth', 'Other income', f.income.otherIncome],
  ];
  for (const [k, label, v] of otherIncome) if (nonZero(v)) income.push({ key: `inc.${k}`, label, projected: v, trace: { kind: 'federal', steps: ['entity_income', 'allocation'] } });
  income.push({ key: 'inc.total', label: 'Total income', projected: f.income.totalIncome, bold: true, trace: { kind: 'federal', steps: ['entity_income', 'allocation', 'loss_limits'] } });
  const ll = f.lossLimitations;
  if (nonZero(ll.suspendedPassiveLoss)) income[income.length - 1]!.chips = [{ text: `Passive loss suspended ${num(ll.suspendedPassiveLoss).toLocaleString('en-US')}`, tone: 'warn' }];
  if (nonZero(ll.excessBusinessLoss)) (income[income.length - 1]!.chips ??= []).push({ text: 'Excess business loss (NOL note)', tone: 'warn' });
  sections.push({ key: 'income', title: 'Income', lines: income });

  const a = f.adjustmentsToIncome;
  const retCapped = f.persons.filter((p) => p.retirement.capped);
  const adj: CalcLine[] = [];
  const adjRows: Array<[string, string, string, CalcLine['chips']]> = [
    ['se', 'Half of self-employment tax', a.halfSeTax, undefined],
    ['ret', 'Retirement contributions', a.retirement, retCapped.length ? [{ text: 'Capped at limit', tone: 'warn' as const }] : undefined],
    ['sehi', 'Self-employed health insurance', a.sehi, f.persons.some((p) => p.sehi.capped) ? [{ text: 'Capped at limit', tone: 'warn' as const }] : undefined],
    ['hsa', 'HSA', a.hsa, f.persons.some((p) => p.hsa.capped) ? [{ text: 'Capped at limit', tone: 'warn' as const }] : undefined],
    ['oth', 'Other adjustments', a.other, undefined],
  ];
  for (const [k, label, v, chips] of adjRows) if (nonZero(v)) adj.push({ key: `adj.${k}`, label, projected: v, chips, trace: { kind: 'federal', steps: ['owner_limits', 'se_tax'] } });
  adj.push({ key: 'adj.agi', label: 'Adjusted gross income', projected: f.agi, bold: true, trace: { kind: 'federal', steps: ['agi'] } });
  sections.push({ key: 'adjustments', title: 'Adjustments', lines: adj });

  const d = f.deductions;
  const other = d.chosen === 'standard' ? d.itemized.total : d.standard.total;
  const ded: CalcLine[] = [
    {
      key: 'ded.main', label: d.chosen === 'standard' ? 'Standard deduction' : 'Itemized deductions', projected: d.deduction,
      sub: `${d.chosen === 'standard' ? 'Itemized' : 'Standard'} would be ${num(other).toLocaleString('en-US')}${d.mode === 'auto' ? ' (auto)' : ' (forced)'}`,
      trace: { kind: 'federal', steps: ['deductions'] },
    },
  ];
  if (d.sch1a.inEffect && nonZero(d.sch1a.total)) ded.push({ key: 'ded.1a', label: 'Schedule 1-A deductions', projected: d.sch1a.total, trace: { kind: 'federal', steps: ['deductions'] } });
  ded.push({
    key: 'ded.qbi', label: 'Qualified business income deduction', projected: f.qbi.deduction,
    chips: f.qbi.method === 'manual' ? [{ text: 'Manual override', tone: 'info' }] : undefined, trace: { kind: 'federal', steps: ['qbi'] },
  });
  ded.push({ key: 'ded.ti', label: 'Taxable income', projected: f.taxableIncome, bold: true, trace: { kind: 'federal', steps: ['taxable_income'] } });
  sections.push({ key: 'deductions', title: 'Deductions', lines: ded });

  const tax: CalcLine[] = [
    {
      key: 'tax.regular', label: 'Regular income tax', projected: f.regularTax.tax,
      sub: f.regularTax.method === 'effective' ? 'Effective-rate override' : `Marginal rate ${pct(f.regularTax.marginalOrdinaryRate)}`,
      trace: { kind: 'federal', steps: ['regular_tax'] },
    },
  ];
  if (nonZero(f.credits.nonrefundableAllowed)) tax.push({ key: 'tax.cr', label: 'Nonrefundable credits', projected: `-${f.credits.nonrefundableAllowed}`, trace: { kind: 'federal', steps: ['credits'] } });
  for (const p of f.persons) if (nonZero(p.seTax)) tax.push({ key: `tax.se.${p.personId}`, label: `Self-employment tax — ${p.displayName}`, projected: p.seTax, trace: { kind: 'federal', steps: ['se_tax'], idPrefix: `se_tax.${p.personId}` } });
  if (nonZero(f.additionalMedicareTax)) tax.push({ key: 'tax.am', label: 'Additional Medicare tax', projected: f.additionalMedicareTax, trace: { kind: 'federal', steps: ['other_taxes'] } });
  if (nonZero(f.niit)) tax.push({ key: 'tax.niit', label: 'Net investment income tax', projected: f.niit, trace: { kind: 'federal', steps: ['other_taxes'] } });
  if (nonZero(f.credits.refundable)) tax.push({ key: 'tax.rf', label: 'Refundable credits', projected: `-${f.credits.refundable}`, trace: { kind: 'federal', steps: ['credits'] } });
  tax.push({ key: 'tax.fed', label: 'Federal total', projected: f.federalTotal, bold: true, trace: { kind: 'federal', steps: ['federal_total'] } });
  sections.push({ key: 'federal', title: 'Federal tax', lines: tax });

  if (r.state && r.state.rows.length > 0) {
    const st: CalcLine[] = r.state.rows.map((s) => {
      const chips: NonNullable<CalcLine['chips']> = [];
      // QA D18: "Rules unverified" only when a rule the state used is not verified (or the federal
      // pattern stood in); other verify reasons (gate inputs missing) read "Verify".
      const rulesUnverified = s.usesFederalFallback || r.rulesUsed.some((u) => u.state === s.state && u.status !== 'verified');
      if (rulesUnverified) chips.push({ text: 'Rules unverified', tone: 'warn' });
      else if (s.verify) chips.push({ text: 'Verify', tone: 'warn' });
      return {
        key: `st.${s.rowId}`, label: `${s.state} — ${s.residency === 'resident' ? 'resident' : 'nonresident'}`,
        sub: s.residency === 'resident'
          ? `Gross ${num(s.grossTax).toLocaleString('en-US')} less ${num(s.creditForOtherStates).toLocaleString('en-US')} other-state credit`
          : `Sourced income ${num(s.sourcedIncome).toLocaleString('en-US')} × ${pct(s.effectiveRate, 2)} — effective-rate estimate; most states compute nonresident tax by ratio of the full return`,
        projected: s.netTax, chips: chips.length ? chips : undefined, trace: { kind: 'state', state: s.state },
      };
    });
    st.push({ key: 'st.total', label: 'State total', projected: r.state.stateTotal, bold: true, trace: { kind: 'state' } });
    sections.push({ key: 'state', title: 'State tax', lines: st });
  }
  sections.push({ key: 'total', title: 'Total', lines: [{ key: 'total', label: 'Total estimated tax', projected: r.summary.total, bold: true }] });
  return sections;
}
