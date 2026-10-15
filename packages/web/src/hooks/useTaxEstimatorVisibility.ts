// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

// Single source of truth for the Tax Estimator sidebar group + route guards
// (features/tax-estimator/MODULE.md D1/D5). Same derivation shape as
// useTrialBalanceVisibility: staff-only surface, one feature flag, plus the
// `tax_estimator` permission resource must be readable. The server enforces all
// of this independently (router 404s client users, flag OFF, no firm).

import type { PracticeFeatureFlagKey } from '@kis-books/shared';
import { useMe } from '../api/hooks/useAuth';
import { useFeatureFlags } from '../api/hooks/useFeatureFlag';
import { useFirms } from '../api/hooks/useFirms';
import { usePermissions } from '../api/hooks/usePermissions';
import { isFirmOnlyEligible, type StaffRole } from './usePracticeVisibility';

export type TaxEstimatorNavKey = 'taxpayers';

export interface TaxEstimatorNavItem {
  key: TaxEstimatorNavKey;
  label: string;
  path: string;
}

const TE_FLAG: PracticeFeatureFlagKey = 'TAX_ESTIMATOR_V1';

// Order = sidebar render order. Items are appended as their phases land.
export const TAX_ESTIMATOR_NAV_CATALOG: readonly TaxEstimatorNavItem[] = [
  { key: 'taxpayers', label: 'Taxpayers', path: '/tax-estimator/taxpayers' },
];

export function filterTaxEstimatorNav(
  items: readonly TaxEstimatorNavItem[],
  role: StaffRole,
  userType: 'staff' | 'client' | undefined,
  flagEnabled: boolean,
  firmStaff: boolean,
  canRead: boolean,
): TaxEstimatorNavItem[] {
  if (userType === 'client') return [];
  // QA D2: a tenant role of `readonly` is NOT excluded. The API serves it every read
  // (R3-07: GETs plus the compute/print POSTs) and MODULE.md gives read-only members
  // the read-only screens; write controls follow /scope `canWrite`.
  if (!role) return [];
  if (!firmStaff || !flagEnabled || !canRead) return [];
  return [...items];
}

export interface TaxEstimatorVisibility {
  ready: boolean;
  showGroup: boolean;
  items: TaxEstimatorNavItem[];
}

export function useTaxEstimatorVisibility(): TaxEstimatorVisibility {
  const { data: meData } = useMe();
  const { data: flagsData } = useFeatureFlags();
  const { data: firmsData } = useFirms();
  const { can } = usePermissions();

  const ready = !!meData && !!flagsData && !!firmsData;
  if (!ready) return { ready: false, showGroup: false, items: [] };

  const role = meData!.user?.role as StaffRole;
  const userType = (meData!.user as { userType?: 'staff' | 'client' }).userType ?? 'staff';
  const user = meData!.user as { isSuperAdmin?: boolean } | undefined;
  const items = filterTaxEstimatorNav(
    TAX_ESTIMATOR_NAV_CATALOG,
    role,
    userType,
    flagsData!.flags?.[TE_FLAG]?.enabled === true,
    isFirmOnlyEligible(!!user?.isSuperAdmin, (firmsData!.firms ?? []).length > 0),
    can('tax_estimator', 'read'),
  );
  return { ready: true, showGroup: items.length > 0, items };
}
