// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect } from 'vitest';
import type { PracticeFeatureFlagKey } from '@kis-books/shared';
import { filterPracticeNav,
  isPracticeStaff, PRACTICE_NAV_CATALOG } from './usePracticeVisibility';

// Every flag turned on — lets us isolate the role / user_type
// gates in tests that aren't about flags.
const allFlagsOn: Partial<Record<PracticeFeatureFlagKey, { enabled: boolean }>> = {
  CLOSE_REVIEW_V1: { enabled: true },
  AI_BUCKET_WORKFLOW_V1: { enabled: true },
  CONDITIONAL_RULES_V1: { enabled: true },
  CLIENT_PORTAL_V1: { enabled: true },
  REMINDERS_V1: { enabled: true },
  TAX_1099_V1: { enabled: true },
  REPORT_BUILDER_V1: { enabled: true },
  RECEIPT_PWA_V1: { enabled: true },
};

describe('filterPracticeNav', () => {
  describe('user_type gate', () => {
    it('returns no items for client user_type regardless of role', () => {
      for (const role of ['owner', 'accountant', 'bookkeeper', 'readonly']) {
        const items = filterPracticeNav(PRACTICE_NAV_CATALOG, role, 'client', allFlagsOn);
        expect(items).toEqual([]);
      }
    });

    it('returns full set for staff owner when flags on', () => {
      const items = filterPracticeNav(PRACTICE_NAV_CATALOG, 'owner', 'staff', allFlagsOn);
      expect(items).toHaveLength(PRACTICE_NAV_CATALOG.length);
    });

    it('treats undefined user_type as not-client (staff default)', () => {
      const items = filterPracticeNav(PRACTICE_NAV_CATALOG, 'owner', undefined, allFlagsOn);
      expect(items).toHaveLength(PRACTICE_NAV_CATALOG.length);
    });
  });

  describe('role gate', () => {
    it('returns empty for readonly role', () => {
      const items = filterPracticeNav(PRACTICE_NAV_CATALOG, 'readonly', 'staff', allFlagsOn);
      expect(items).toEqual([]);
    });

    it('returns empty when role is missing', () => {
      const items = filterPracticeNav(PRACTICE_NAV_CATALOG, undefined, 'staff', allFlagsOn);
      expect(items).toEqual([]);
    });

    it('bookkeeper sees all bookkeeper-tier items (incl. client-portal + reminders, now staff-editable)', () => {
      const items = filterPracticeNav(PRACTICE_NAV_CATALOG, 'bookkeeper', 'staff', allFlagsOn);
      const keys = items.map((i) => i.key).sort();
      // Client Portal + Reminders were lowered from owner-tier to
      // bookkeeper-tier so firm staff can manage them.
      expect(keys).toEqual(['1099', 'client-portal', 'close-review', 'receipts-inbox', 'reminders', 'report-builder', 'rules']);
      expect(keys).toContain('client-portal');
      expect(keys).toContain('reminders');
    });

    it('accountant treated as bookkeeper-tier (sees client-portal + reminders)', () => {
      const items = filterPracticeNav(PRACTICE_NAV_CATALOG, 'accountant', 'staff', allFlagsOn);
      const keys = items.map((i) => i.key);
      expect(keys).toContain('close-review');
      expect(keys).toContain('client-portal');
      expect(keys).toContain('reminders');
    });
  });

  describe('flag gate', () => {
    it('returns only items whose flag is enabled', () => {
      const onlyCloseReview: Partial<Record<PracticeFeatureFlagKey, { enabled: boolean }>> = {
        CLOSE_REVIEW_V1: { enabled: true },
      };
      const items = filterPracticeNav(PRACTICE_NAV_CATALOG, 'owner', 'staff', onlyCloseReview);
      expect(items).toHaveLength(1);
      expect(items[0]?.key).toBe('close-review');
    });

    it('treats a flag row with enabled=false as off', () => {
      const withSomeOff: Partial<Record<PracticeFeatureFlagKey, { enabled: boolean }>> = {
        ...allFlagsOn,
        CLIENT_PORTAL_V1: { enabled: false },
      };
      const items = filterPracticeNav(PRACTICE_NAV_CATALOG, 'owner', 'staff', withSomeOff);
      expect(items.map((i) => i.key)).not.toContain('client-portal');
    });

    it('treats a missing flag row as off', () => {
      const items = filterPracticeNav(PRACTICE_NAV_CATALOG, 'owner', 'staff', {});
      expect(items).toEqual([]);
    });
  });

  describe('practice-staff gate', () => {
    it('hides everything from a bare owner who is not practice staff (self-signup client)', () => {
      const items = filterPracticeNav(PRACTICE_NAV_CATALOG, 'owner', 'staff', allFlagsOn, false);
      expect(items).toEqual([]);
    });

    it('isPracticeStaff: super admin, accountant/bookkeeper role, or firm membership qualify; bare owner does not', () => {
      expect(isPracticeStaff('owner', false, false)).toBe(false);
      expect(isPracticeStaff('owner', true, false)).toBe(true);
      expect(isPracticeStaff('owner', false, true)).toBe(true);
      expect(isPracticeStaff('accountant', false, false)).toBe(true);
      expect(isPracticeStaff('bookkeeper', false, false)).toBe(true);
    });
  });
});
