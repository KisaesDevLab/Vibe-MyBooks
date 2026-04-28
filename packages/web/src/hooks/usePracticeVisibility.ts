// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import type { PracticeFeatureFlagKey } from '@kis-books/shared';
import { useMe } from '../api/hooks/useAuth';
import { useFeatureFlags } from '../api/hooks/useFeatureFlag';

// Single source of truth for which Practice sidebar children are
// visible to the current user. Keeps the role/flag matrix in one
// place so the Sidebar component, the PracticeLayout redirect
// guard, and the Phase-1 unit tests can all consume the same
// derivation.
//
// Section grouping matches VIBE_MYBOOKS_PRACTICE_BUILD_PLAN
// Sidebar Integration Design (lines 43–69 of the plan).

export type PracticeNavKey =
  | 'close-review'
  | 'rules'
  | 'receipts-inbox'
  | '1099'
  | 'client-portal'
  | 'reminders'
  | 'report-builder';

export type PracticeSection = 'close-cycle' | 'client-communication';

export interface PracticeNavItem {
  key: PracticeNavKey;
  label: string;
  path: string;
  section: PracticeSection;
  flag: PracticeFeatureFlagKey;
  minRole: 'owner' | 'bookkeeper';
}

// Static catalog — the order here is the order rendered in the
// sidebar within each section.
export const PRACTICE_NAV_CATALOG: readonly PracticeNavItem[] = [
  { key: 'close-review',    label: 'Close Review',    path: '/practice/close-review',    section: 'close-cycle',          flag: 'CLOSE_REVIEW_V1',      minRole: 'bookkeeper' },
  { key: 'rules',           label: 'Rules',           path: '/practice/rules',           section: 'close-cycle',          flag: 'CONDITIONAL_RULES_V1', minRole: 'bookkeeper' },
  { key: 'receipts-inbox',  label: 'Receipts Inbox',  path: '/practice/receipts-inbox',  section: 'close-cycle',          flag: 'RECEIPT_PWA_V1',       minRole: 'bookkeeper' },
  { key: '1099',            label: '1099 Center',     path: '/practice/1099',            section: 'close-cycle',          flag: 'TAX_1099_V1',          minRole: 'bookkeeper' },
  { key: 'client-portal',   label: 'Client Portal',   path: '/practice/client-portal',   section: 'client-communication', flag: 'CLIENT_PORTAL_V1',     minRole: 'owner' },
  { key: 'reminders',       label: 'Reminders',       path: '/practice/reminders',       section: 'client-communication', flag: 'REMINDERS_V1',         minRole: 'owner' },
  { key: 'report-builder',  label: 'Report Builder',  path: '/practice/report-builder',  section: 'client-communication', flag: 'REPORT_BUILDER_V1',    minRole: 'bookkeeper' },
];

export type StaffRole = 'owner' | 'accountant' | 'bookkeeper' | 'readonly' | string | undefined;

// Pure helper — exported so the unit test can drive the matrix
// without a React render. Mirrors the role-vocabulary decision in
// phase-1-plan.md: readonly sees no Practice children; bookkeeper
// and accountant are both bookkeeper-tier; owner is admin-tier.
export function filterPracticeNav(
  items: readonly PracticeNavItem[],
  role: StaffRole,
  userType: 'staff' | 'client' | undefined,
  flags: Partial<Record<PracticeFeatureFlagKey, { enabled: boolean }>>,
): PracticeNavItem[] {
  if (userType === 'client') return [];
  if (role === 'readonly' || !role) return [];
  return items.filter((item) => {
    if (item.minRole === 'owner' && role !== 'owner') return false;
    // bookkeeper-tier: owner, accountant, bookkeeper are all allowed
    if (item.minRole === 'bookkeeper' && !['owner', 'accountant', 'bookkeeper'].includes(role)) return false;
    return flags[item.flag]?.enabled === true;
  });
}

export interface PracticeVisibility {
  ready: boolean;
  showGroup: boolean;
  items: PracticeNavItem[];
  sections: Record<PracticeSection, PracticeNavItem[]>;
}

export function usePracticeVisibility(): PracticeVisibility {
  const { data: meData } = useMe();
  const { data: flagsData } = useFeatureFlags();

  const ready = !!meData && !!flagsData;
  if (!ready) {
    return {
      ready: false,
      showGroup: false,
      items: [],
      sections: { 'close-cycle': [], 'client-communication': [] },
    };
  }

  const role = meData!.user?.role as StaffRole;
  // Treat missing userType as 'staff' for backwards-compatibility
  // with pre-Phase-1 servers.
  const userType = (meData!.user as { userType?: 'staff' | 'client' }).userType ?? 'staff';

  const items = filterPracticeNav(
    PRACTICE_NAV_CATALOG,
    role,
    userType,
    flagsData!.flags ?? {},
  );

  return {
    ready: true,
    showGroup: items.length > 0,
    items,
    sections: {
      'close-cycle': items.filter((i) => i.section === 'close-cycle'),
      'client-communication': items.filter((i) => i.section === 'client-communication'),
    },
  };
}
