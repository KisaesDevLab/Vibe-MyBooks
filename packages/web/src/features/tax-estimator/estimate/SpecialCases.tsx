// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import type { EstimateResultDTO } from '@kis-books/shared';
import { dollars, fmtDate, num, pct } from './format';

/** Farmer / fisherman (Sch F) and C corp (entity-level) summaries — shown only when the engine produced them. */
export function SpecialCases({ estimate: r }: { estimate: EstimateResultDTO }) {
  const f = r.farmer;
  if (!f && r.ccorps.length === 0) return null;
  return (
    <div className="space-y-4">
      {f && (
        <section aria-label="Farmer summary" className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
          <h3 className="text-base font-semibold text-gray-900">{f.label === 'fisherman' ? 'Fisherman' : 'Farmer'} estimate rules</h3>
          <p className="text-sm text-gray-700">
            {f.qualifies
              ? `Qualifies (${f.basis.replace('_', ' ')}, gross-income test ${pct(f.requiredRatio, 0)}): one installment, due ${fmtDate(f.installments[0]?.dueDate)}.`
              : 'Does not qualify; the regular quarterly rules apply.'}
          </p>
          {f.qualifies && <p className="text-sm text-gray-600">{f.fileAndPayNote} (file and pay by {fmtDate(f.fileAndPayByDate)}).</p>}
          {f.requiredAnnualPayment && <p className="text-sm tabular-nums">Required annual payment {dollars(f.requiredAnnualPayment.required)} (current year {dollars(f.requiredAnnualPayment.currentYear)}{f.requiredAnnualPayment.priorYear != null ? `, prior year ${dollars(f.requiredAnnualPayment.priorYear)}` : ''}).</p>}
        </section>
      )}
      {r.ccorps.map((c) => (
        <section key={c.companyId} aria-label={`${c.companyName} C corporation`} className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
          <h3 className="text-base font-semibold text-gray-900">{c.companyName} &middot; C corporation (entity level)</h3>
          <p className="text-sm text-gray-700 tabular-nums">
            Taxable income {dollars(c.taxableIncome)} at {pct(c.rate)} = federal {dollars(c.federalTax)}; state {dollars(c.stateTotal)}; total {dollars(c.totalTax)}. Fiscal year {fmtDate(c.fiscalYearStart)} to {fmtDate(c.fiscalYearEnd)}.
          </p>
          {c.largeCorporation && <p className="text-xs text-gray-600">Large corporation: the first installment is based on the current year; any shortfall is recaptured in the second installment.</p>}
          {!c.estimatesRequired && <p className="text-xs text-gray-600">Federal tax is below the minimum for estimates; the schedule is shown for reference.</p>}
          {c.states.length > 0 && <p className="text-xs text-gray-600">Apportionment: {c.states.map((s) => `${s.state} ${pct(s.apportionmentPct)}`).join(', ')}</p>}
          <table className="w-full text-sm">
            <thead><tr className="text-xs uppercase text-gray-500"><th scope="col" className="text-left py-1">#</th><th scope="col" className="text-left">Due</th><th scope="col" className="text-right">Required</th><th scope="col" className="text-right">Recapture</th></tr></thead>
            <tbody>
              {c.installments.map((i) => (
                <tr key={i.number} className="border-t border-gray-100"><td className="py-1">{i.number}</td><td>{fmtDate(i.dueDate)}</td>
                  <td className="text-right tabular-nums">{dollars(i.required)}</td><td className="text-right tabular-nums">{num(i.recapture) > 0 ? dollars(i.recapture) : '—'}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
