// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import type { FilingStatus, ActivityType, PartnerSeStatus } from '@kis-books/shared';

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  single: 'Single', mfj: 'Married filing jointly', mfs: 'Married filing separately',
  hoh: 'Head of household', qss: 'Qualifying surviving spouse',
};
export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  active: 'Active', passive: 'Passive', rental: 'Rental', investment: 'Investment',
};
export const SE_STATUS_LABELS: Record<PartnerSeStatus, string> = {
  general: 'General partner', limited: 'Limited partner', llc_member_manager: 'LLC member-manager',
};
export const SAFE_HARBOR_LABELS = {
  prior_year: 'Prior year (100% / 110%)', lesser_of: 'Lesser of current and prior', current_year: 'Current year (90%)',
} as const;
export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export const SELECT_CLASS = 'block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500';
