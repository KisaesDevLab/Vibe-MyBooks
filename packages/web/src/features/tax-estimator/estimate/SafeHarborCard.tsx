// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import type { JurisdictionEstimate } from '@kis-books/shared';
import { dollars, JURISDICTION_LABEL, num, pct } from './format';

const RULE_LABEL: Record<string, string> = { current_year: 'Current year', prior_year: 'Prior year', lesser_of: 'Lesser of both' };
const SOURCE_LABEL: Record<string, string> = { year: 'this year’s setting', taxpayer: 'taxpayer override', firm_default: 'firm default' };

function Tile({ title, amount, sub, recommended }: { title: string; amount: string; sub: string; recommended: boolean }) {
  return (
    <div className={`rounded-lg border p-3 space-y-1 ${recommended ? 'border-primary-600 ring-1 ring-primary-600 bg-primary-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-700">{title}</span>
        {recommended && <span className="rounded bg-primary-600 px-1.5 py-0.5 text-xs font-medium text-white">Recommended</span>}
      </div>
      <div className="text-xl font-semibold tabular-nums text-gray-900">{amount}</div>
      <div className="text-xs text-gray-500">{sub}</div>
    </div>
  );
}

interface Props { estimate: JurisdictionEstimate; ruleSource: string; rule: string }

/** Safe-harbor card: BOTH rules side by side, the recommended one outlined, then the required / paid / remaining lines. */
export function SafeHarborCard({ estimate: e, ruleSource, rule }: Props) {
  const sh = e.safeHarbor;
  const prior = sh.priorYear;
  return (
    <section aria-label={`${JURISDICTION_LABEL(e.jurisdiction)} safe harbor`} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-gray-900">Safe harbor</h3>
        <span className="rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs text-gray-700">
          {RULE_LABEL[rule] ?? rule} &middot; {SOURCE_LABEL[ruleSource] ?? ruleSource}
        </span>
        {e.verify && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">Verify</span>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Tile title={`${pct(sh.currentYear.pct, 0)} of current year`} amount={dollars(sh.currentYear.amount)} sub={`Projected tax ${dollars(sh.currentYear.tax)}`}
          recommended={sh.appliedRule === 'current_year'} />
        <Tile title={`${prior.pct == null ? 'Prior year' : `${pct(prior.pct, 0)} of prior year`} (guaranteed)`}
          amount={prior.amount == null ? 'Not available' : dollars(prior.amount)}
          sub={prior.available ? `Prior-year tax ${dollars(prior.tax)}${prior.highAgiApplied ? ' · high-AGI percentage' : ''}` : (prior.unavailableDetail ?? 'Prior-year safe harbor is unavailable.')}
          recommended={sh.appliedRule === 'prior_year'} />
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        <dt className="text-gray-600">Required annual payment</dt><dd className="tabular-nums font-medium">{dollars(sh.requiredAnnualPayment)}</dd>
        <dt className="text-gray-600">Less withholding (treated as even)</dt><dd className="tabular-nums">{dollars(e.totals.withholding)}</dd>
        <dt className="text-gray-600">Estimates paid to date</dt><dd className="tabular-nums">{dollars(e.totals.estimatesPaid)}</dd>
        <dt className="font-medium text-gray-900">Remaining</dt><dd className="tabular-nums font-semibold">{dollars(e.totals.unpaid)}</dd>
      </dl>
      {sh.noPenaltyReason && <p className="text-xs text-gray-600">No underpayment penalty applies: the prior-year tax on a filed 12-month return was zero.</p>}
      {num(e.totals.excess) > 0 && <p className="text-xs text-gray-600">Overpaid by {dollars(e.totals.excess)}.</p>}
      {sh.notes.length > 0 && <ul className="list-disc pl-5 text-xs text-gray-500 space-y-0.5">{sh.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
    </section>
  );
}
