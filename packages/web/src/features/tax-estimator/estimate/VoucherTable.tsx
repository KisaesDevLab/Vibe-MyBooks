// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import type { JurisdictionEstimate } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { TableScroll } from '../../../components/ui/TableScroll';
import { dollars, fmtDate, JURISDICTION_LABEL, num } from './format';

const TH = 'px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500';

interface Props { estimate: JurisdictionEstimate; onTrace?: (jurisdiction: string) => void }

/** Voucher schedule for one jurisdiction: Regular / Sch AI / withholding / net / paid / remaining / penalty / status / pay-now. */
export function VoucherTable({ estimate: e, onTrace }: Props) {
  if (!e.estimatesRequired || e.installments.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-700">
        No estimated payments required for {JURISDICTION_LABEL(e.jurisdiction)}. {e.estimatesRequiredReason}
      </p>
    );
  }
  const penalties = e.penalty?.installments ?? [];
  const penaltyOf = (i: number) => penalties.find((p) => p.index === i)?.penalty ?? '0';
  return (
    <div className="space-y-2">
      <TableScroll>
        <table className="min-w-[56rem] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className={`${TH} text-left`}>Qtr</th><th scope="col" className={`${TH} text-left`}>Due</th>
              <th scope="col" className={`${TH} text-right`}>Regular</th><th scope="col" className={`${TH} text-right`}>Sch AI</th>
              <th scope="col" className={`${TH} text-right`}>W-2 credit</th><th scope="col" className={`${TH} text-right`}>From estimates</th>
              <th scope="col" className={`${TH} text-right`}>Paid</th><th scope="col" className={`${TH} text-right`}>Remaining</th>
              <th scope="col" className={`${TH} text-right`}>Penalty est.</th><th scope="col" className={`${TH} text-left`}>Status</th>
              <th scope="col" className={`${TH} text-right`}>Pay now</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {e.installments.map((i) => {
              const aiUsed = i.annualizedInstallment != null && num(i.annualizedInstallment) < num(i.regularInstallment);
              return (
                <tr key={i.index}>
                  <td className="px-3 py-2 font-medium text-gray-900">{i.label}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{fmtDate(i.dueDate)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{dollars(i.regularInstallment)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${aiUsed ? 'font-bold' : 'text-gray-600'}`} title={aiUsed ? 'Annualized income lowers this installment' : undefined}>
                    {i.annualizedInstallment == null ? '—' : dollars(i.annualizedInstallment)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{dollars(i.withholdingShare)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{dollars(i.netRequired)}{num(i.carriedIn) > 0 && <div className="text-xs text-gray-500">after {dollars(i.carriedIn)} carryover</div>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{dollars(i.estimatesApplied)}{i.paidInFullOn && <div className="text-xs text-gray-500">full {fmtDate(i.paidInFullOn)}</div>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{dollars(i.unpaid)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{dollars(penaltyOf(i.index))}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${i.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>{i.status === 'paid' ? 'Paid' : 'Unpaid'}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium" title="Amount to pay with this voucher to be current">{dollars(i.catchUpAmount)}</td>
                </tr>
              );
            })}
          </tbody>
          {e.penalty && (
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td colSpan={8} className="px-3 py-2 text-right">Estimated penalty{e.penalty.computed ? '' : ' (not computable — verify)'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{dollars(e.penalty.total)}</td><td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </TableScroll>
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span>Payments are applied to the earliest unpaid installment. Return due {fmtDate(e.returnDueDate)}{e.lastInstallmentReliefDate ? `; file and pay by ${fmtDate(e.lastInstallmentReliefDate)} to waive the last installment` : ''}.</span>
        {onTrace && <Button size="sm" variant="ghost" onClick={() => onTrace(e.jurisdiction)}>Trace vouchers</Button>}
      </div>
      {e.notes.length > 0 && <ul className="list-disc pl-5 text-xs text-gray-500 space-y-0.5">{e.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
    </div>
  );
}

/** Jurisdiction tabs (Federal + each state) with a per-tab amount or "none required". */
export function JurisdictionTabs({ items, selected, onSelect }: { items: JurisdictionEstimate[]; selected: string; onSelect: (j: string) => void }) {
  return (
    <div role="tablist" aria-label="Jurisdiction" className="flex flex-wrap gap-2">
      {items.map((e) => {
        const required = e.estimatesRequired && e.installments.length > 0;
        return (
          <button key={e.jurisdiction} type="button" role="tab" aria-selected={e.jurisdiction === selected} onClick={() => onSelect(e.jurisdiction)}
            className={`rounded-full border px-3 py-1 text-sm ${e.jurisdiction === selected ? 'border-primary-600 bg-primary-50 text-primary-800 font-medium' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>
            {JURISDICTION_LABEL(e.jurisdiction)} <span className="text-xs text-gray-500">{required ? `${dollars(e.safeHarbor.requiredAnnualPayment)}/yr` : 'none required'}</span>
          </button>
        );
      })}
    </div>
  );
}

export function useJurisdictionTab(items: JurisdictionEstimate[]) {
  const [sel, setSel] = useState('federal');
  const selected = items.some((i) => i.jurisdiction === sel) ? sel : (items[0]?.jurisdiction ?? 'federal');
  return [selected, setSel] as const;
}
