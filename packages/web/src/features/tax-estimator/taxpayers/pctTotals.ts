// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import type { LinkDTO, PersonRole } from '@kis-books/shared';

const SCALE = 10000; // percentages carry four decimals, same as the database column
const FULL = 100 * SCALE;

export interface PctTotals {
  profit: number;
  loss: number;
  profitOver: boolean;
  lossOver: boolean;
  profitUnder: boolean;
  lossUnder: boolean;
}

const scaled = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? 0 : Math.round(v * SCALE));

/**
 * Live total of profit % / loss % for one company + year across ALL persons'
 * links (the person being edited contributes the draft values, not the stored
 * ones). Mirrors the server rule: over 100 is an error, under 100 a warning.
 */
export function computePctTotals(
  links: readonly LinkDTO[],
  draft: { personRole: PersonRole; tenantId: string; companyId: string; taxYear: number; profitPct: number | null; lossPct: number | null },
): PctTotals {
  const others = links.filter((l) => l.tenantId === draft.tenantId && l.companyId === draft.companyId
    && l.taxYear === draft.taxYear && l.personRole !== draft.personRole && !l.outOfScope);
  const profit = others.reduce((a, l) => a + scaled(l.profitPct), 0) + scaled(draft.profitPct);
  const loss = others.reduce((a, l) => a + scaled(l.lossPct), 0) + scaled(draft.lossPct);
  return {
    profit: profit / SCALE, loss: loss / SCALE,
    profitOver: profit > FULL, lossOver: loss > FULL,
    profitUnder: draft.profitPct != null && profit < FULL, lossUnder: draft.lossPct != null && loss < FULL,
  };
}
