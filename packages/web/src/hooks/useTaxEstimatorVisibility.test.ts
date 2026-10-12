// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect } from 'vitest';
import { filterTaxEstimatorNav, TAX_ESTIMATOR_NAV_CATALOG } from './useTaxEstimatorVisibility';

describe('filterTaxEstimatorNav', () => {
  const show = (role: string | undefined, userType: 'staff' | 'client', flag: boolean, firm: boolean, read: boolean) =>
    filterTaxEstimatorNav(TAX_ESTIMATOR_NAV_CATALOG, role, userType, flag, firm, read);

  it('shows Taxpayers only for flag-on firm staff who can read tax_estimator', () => {
    expect(show('accountant', 'staff', true, true, true).map((i) => i.path)).toEqual(['/tax-estimator/taxpayers']);
    expect(show('accountant', 'staff', false, true, true)).toEqual([]);
    expect(show('accountant', 'staff', true, false, true)).toEqual([]);
    expect(show('accountant', 'staff', true, true, false)).toEqual([]);
    expect(show('accountant', 'client', true, true, true)).toEqual([]);
    expect(show(undefined, 'staff', true, true, true)).toEqual([]);
  });

  it('QA D2: a tenant-role readonly firm member sees the (read-only) group, matching the API which serves their reads', () => {
    expect(show('readonly', 'staff', true, true, true).map((i) => i.path)).toEqual(['/tax-estimator/taxpayers']);
    expect(show('readonly', 'staff', true, true, false)).toEqual([]);
    expect(show('readonly', 'client', true, true, true)).toEqual([]);
    expect(show(undefined, 'staff', true, true, true)).toEqual([]);
  });
});
