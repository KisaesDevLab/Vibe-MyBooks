// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect } from 'vitest';
import { filterTbNav, TB_NAV_CATALOG } from './useTrialBalanceVisibility';

describe('filterTbNav', () => {
  it('hides Financial Statements until FINANCIAL_STATEMENTS_V1 is on', () => {
    const off = filterTbNav(TB_NAV_CATALOG, 'owner', 'staff', true, true, {});
    expect(off.map((i) => i.key)).not.toContain('financial-statements');
    const on = filterTbNav(TB_NAV_CATALOG, 'owner', 'staff', true, true, { FINANCIAL_STATEMENTS_V1: true });
    expect(on.map((i) => i.key)).toContain('financial-statements');
  });

  it('never shows anything to client users or with the TB flag off', () => {
    expect(filterTbNav(TB_NAV_CATALOG, 'owner', 'client', true, true, { FINANCIAL_STATEMENTS_V1: true })).toEqual([]);
    expect(filterTbNav(TB_NAV_CATALOG, 'owner', 'staff', false, true, { FINANCIAL_STATEMENTS_V1: true })).toEqual([]);
  });
});
