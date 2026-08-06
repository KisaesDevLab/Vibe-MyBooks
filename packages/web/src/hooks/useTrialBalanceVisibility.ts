// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Single source of truth for the Trial Balance sidebar group + route
// guards (TB module, docs/tb/BUILD_PLAN.md). Same derivation shape as
// usePracticeVisibility: staff-only surface, one feature flag for the
// whole module, per-item minRole. Items are appended here as their
// phases land — never link a page that doesn't exist yet.

import type { PracticeFeatureFlagKey } from '@kis-books/shared';
import { useMe } from '../api/hooks/useAuth';
import { useFeatureFlags } from '../api/hooks/useFeatureFlag';
import { useFirms } from '../api/hooks/useFirms';
import { isPracticeStaff, type StaffRole } from './usePracticeVisibility';

export type TbNavKey =
  | 'workpaper'
  | 'mapping'
  | 'ajes'
  | 'leadsheets'
  | 'tax-entries'
  | 'm1'
  | 'reports'
  | 'exports'
  | 'settings';

export interface TbNavItem {
  key: TbNavKey;
  label: string;
  path: string;
  minRole: 'owner' | 'bookkeeper';
}

const TB_FLAG: PracticeFeatureFlagKey = 'TRIAL_BALANCE_V1';

// Order = sidebar render order (mirrors the Vibe TB TAX menu).
export const TB_NAV_CATALOG: readonly TbNavItem[] = [
  { key: 'ajes', label: 'Adjusting Entries', path: '/tb/ajes', minRole: 'bookkeeper' },
  { key: 'settings', label: 'TB Settings', path: '/tb/settings', minRole: 'bookkeeper' },
];

export function filterTbNav(
  items: readonly TbNavItem[],
  role: StaffRole,
  userType: 'staff' | 'client' | undefined,
  flagEnabled: boolean,
  staff: boolean,
): TbNavItem[] {
  if (userType === 'client') return [];
  if (role === 'readonly' || !role) return [];
  if (!staff) return [];
  if (!flagEnabled) return [];
  return items.filter((item) => {
    if (item.minRole === 'owner' && role !== 'owner') return false;
    if (item.minRole === 'bookkeeper' && !['owner', 'accountant', 'bookkeeper'].includes(role)) return false;
    return true;
  });
}

export interface TbVisibility {
  ready: boolean;
  showGroup: boolean;
  items: TbNavItem[];
}

export function useTrialBalanceVisibility(): TbVisibility {
  const { data: meData } = useMe();
  const { data: flagsData } = useFeatureFlags();
  const { data: firmsData } = useFirms();

  const ready = !!meData && !!flagsData && !!firmsData;
  if (!ready) return { ready: false, showGroup: false, items: [] };

  const role = meData!.user?.role as StaffRole;
  const userType = (meData!.user as { userType?: 'staff' | 'client' }).userType ?? 'staff';
  const user = meData!.user as { isSuperAdmin?: boolean } | undefined;
  const items = filterTbNav(
    TB_NAV_CATALOG,
    role,
    userType,
    flagsData!.flags?.[TB_FLAG]?.enabled === true,
    isPracticeStaff(role, !!user?.isSuperAdmin, (firmsData!.firms ?? []).length > 0),
  );
  return { ready: true, showGroup: items.length > 0, items };
}
