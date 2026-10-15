// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { sumMonthly } from '@kis-books/shared';
import { FULL_MONTH_LABELS, fmtMoney } from './labels';

/** The 12-month allocation of one adjustment. `months` comes from the shared pure allocation module. */
export function AllocationStrip({ months }: { months: number[] }) {
  return (
    <div role="group" aria-label="Monthly allocation" data-testid="allocation-strip">
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-1 text-xs">
        {FULL_MONTH_LABELS.map((m, i) => (
          <div key={m} className={`rounded border px-1 py-1 text-center ${(months[i] ?? 0) !== 0 ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-gray-50 text-gray-400'}`}>
            <div className="text-[10px] uppercase text-gray-500">{m}</div>
            <div data-testid={`strip-${m}`} className="tabular-nums">{(months[i] ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-gray-600">Year total <span data-testid="strip-total" className="font-medium tabular-nums">{fmtMoney(sumMonthly(months))}</span></p>
    </div>
  );
}
