// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { useState } from 'react';
import Decimal from 'decimal.js';
import type { TaxBasisPl } from '@kis-books/shared';
import { INCOME_CHARACTERS, presentWarningMessage } from '@kis-books/shared';
import { uniqueWarnings } from './ReadinessPanel';
import { formatMoney } from '../../../utils/money';

const CHAR_LABEL = (c: string) => c.replace(/_/g, ' ');

/** Collapsible book net income -> reclasses -> tax-basis profit reconciliation with the engine trace. */
export function PreviewCard({ pl }: { pl: TaxBasisPl }) {
  const [open, setOpen] = useState(false);
  const reclass = new Decimal(pl.taxBasisProfit).minus(pl.bookNetIncome).toFixed(4);
  return (
    <section className="bg-white rounded-lg border border-gray-200" aria-label="Tax-basis profit preview">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
        className="w-full text-left px-4 py-3 text-lg font-semibold text-gray-900">
        {open ? '▾' : '▸'} Preview tax-basis profit
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-gray-500">{pl.periodStart} through {pl.throughDate} ({pl.monthsElapsed} months, {pl.basis} basis)</p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm max-w-md" data-testid="reconciliation">
            <dt>Book net income</dt><dd className="text-right tabular-nums">{formatMoney(pl.bookNetIncome)}</dd>
            <dt>Reclasses</dt><dd className="text-right tabular-nums">{formatMoney(reclass)}</dd>
            <dt className="font-semibold">Tax-basis profit</dt><dd className="text-right tabular-nums font-semibold">{formatMoney(pl.taxBasisProfit)}</dd>
          </dl>
          <table className="text-sm min-w-[18rem]">
            <thead className="text-xs uppercase tracking-wide text-gray-500"><tr><th className="text-left pr-6">Character</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {INCOME_CHARACTERS.filter((c) => !new Decimal(pl.byCharacter[c]).isZero()).map((c) => (
                <tr key={c}><td className="capitalize pr-6">{CHAR_LABEL(c)}</td><td className="text-right tabular-nums">{formatMoney(pl.byCharacter[c])}</td></tr>
              ))}
            </tbody>
          </table>
          <table className="min-w-full text-sm" aria-label="Trace">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-left">Source</th></tr>
            </thead>
            <tbody>
              {pl.trace.map((t, i) => (
                <tr key={i} className="border-b last:border-0" data-testid="trace-row">
                  <td className="px-3 py-1.5">{t.label}{t.formula && <div className="text-xs text-gray-500">{t.formula}</div>}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{formatMoney(t.amount)}</td>
                  <td className="px-3 py-1.5 text-gray-600">{t.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {uniqueWarnings(pl.warnings).map((w) => <p key={w.code + w.message} className="text-sm text-amber-700" role="status">{presentWarningMessage(w)}</p>)}
        </div>
      )}
    </section>
  );
}
