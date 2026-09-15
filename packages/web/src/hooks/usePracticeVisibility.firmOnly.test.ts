// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// `firmOnly` catalog entries (today: Uncategorized) belong to firm members
// and super admins. A non-firm accountant/bookkeeper is practice staff but
// uses the Banking twin instead, so the Practice entry is dropped for them.

import { describe, it, expect } from 'vitest';
import type { PracticeFeatureFlagKey } from '@kis-books/shared';
import { PRACTICE_NAV_CATALOG, filterPracticeNav, isFirmOnlyEligible } from './usePracticeVisibility';

const allFlagsOn = Object.fromEntries(
  PRACTICE_NAV_CATALOG.map((i) => [i.flag, { enabled: true }]),
) as Partial<Record<PracticeFeatureFlagKey, { enabled: boolean }>>;

describe('firmOnly practice items', () => {
  it('only Uncategorized is firmOnly', () => {
    expect(PRACTICE_NAV_CATALOG.filter((i) => i.firmOnly).map((i) => i.key)).toEqual(['uncategorized']);
  });
  it('a firm member (or super admin) sees the full set', () => {
    const items = filterPracticeNav(PRACTICE_NAV_CATALOG, 'accountant', 'staff', allFlagsOn, true, true);
    expect(items.map((i) => i.key)).toContain('uncategorized');
  });
  it('a non-firm accountant loses only Uncategorized', () => {
    const items = filterPracticeNav(PRACTICE_NAV_CATALOG, 'accountant', 'staff', allFlagsOn, true, false);
    expect(items.map((i) => i.key)).not.toContain('uncategorized');
    expect(items.length).toBe(PRACTICE_NAV_CATALOG.length - 1);
  });
  it('isFirmOnlyEligible: super admins qualify even with no firms; firm members qualify; others do not', () => {
    expect(isFirmOnlyEligible(true, false)).toBe(true);
    expect(isFirmOnlyEligible(false, true)).toBe(true);
    expect(isFirmOnlyEligible(false, false)).toBe(false);
  });
});
