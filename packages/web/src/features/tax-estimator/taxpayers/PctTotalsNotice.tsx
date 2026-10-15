// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import type { PctTotals } from './pctTotals';

/** Live over-100 error / under-100 warning for the profit and loss shares of one company + year. */
export function PctTotalsNotice({ totals }: { totals: PctTotals }) {
  const items: Array<{ kind: 'error' | 'warn'; text: string }> = [];
  if (totals.profitOver) items.push({ kind: 'error', text: `Profit shares total ${totals.profit}% for this company and year. The total cannot exceed 100%.` });
  else if (totals.profitUnder) items.push({ kind: 'warn', text: `Profit shares total ${totals.profit}% (under 100%). The remainder is not allocated to this taxpayer.` });
  if (totals.lossOver) items.push({ kind: 'error', text: `Loss shares total ${totals.loss}% for this company and year. The total cannot exceed 100%.` });
  else if (totals.lossUnder) items.push({ kind: 'warn', text: `Loss shares total ${totals.loss}% (under 100%).` });
  if (items.length === 0) return null;
  return (
    <ul className="space-y-1" data-testid="pct-totals-notice">
      {items.map((i) => (
        <li key={i.text} role={i.kind === 'error' ? 'alert' : 'status'}
          className={i.kind === 'error' ? 'text-sm text-red-700' : 'text-sm text-amber-700'}>
          {i.text}
        </li>
      ))}
    </ul>
  );
}
