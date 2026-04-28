// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import type { PracticeFeatureFlagKey } from '@kis-books/shared';
import { useMe } from '../../api/hooks/useAuth';
import { useFeatureFlag } from '../../api/hooks/useFeatureFlag';
import { PRACTICE_NAV_CATALOG, type StaffRole } from '../../hooks/usePracticeVisibility';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

interface PracticeLayoutProps {
  flag: PracticeFeatureFlagKey;
  minRole: 'owner' | 'bookkeeper';
  children: ReactNode;
}

// Shared wrapper for every /practice/* route. Responsibilities:
//   1. Kick out users who shouldn't be here — client user_type,
//      readonly role, insufficient role for the specific item.
//   2. Kick out when the flag is off (short-circuits before the
//      placeholder renders).
//   3. Render breadcrumb "Practice > {current}" from the matched
//      nav catalog entry.
// The catalog is the single source of truth for the breadcrumb
// label so a path edit propagates automatically.
export function PracticeLayout({ flag, minRole, children }: PracticeLayoutProps) {
  const { data: meData, isLoading: meLoading } = useMe();
  const flagEnabled = useFeatureFlag(flag);
  const location = useLocation();

  if (meLoading || flagEnabled === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const role = meData?.user?.role as StaffRole;
  const userType = (meData?.user as { userType?: 'staff' | 'client' } | undefined)?.userType ?? 'staff';

  // Client user_type never sees Practice (redirect to home); the
  // sidebar already hides the group DOM-side, but URL-bar
  // navigation still needs the server-unreachable equivalent
  // here. /portal will live on a separate auth surface (Phase 4)
  // so sending them to `/` is the safe default for now.
  if (userType === 'client') {
    return <Navigate to="/" replace />;
  }

  // Readonly sees no Practice children at all.
  if (role === 'readonly' || !role) {
    return <Navigate to="/" replace />;
  }

  // Role gate — owner-tier items require owner; bookkeeper-tier
  // accepts owner/accountant/bookkeeper. Mirrors filterPracticeNav
  // so the rules stay in one logical place even though this route-
  // level check is expressed directly.
  if (minRole === 'owner' && role !== 'owner') {
    return <Navigate to="/" replace />;
  }
  if (minRole === 'bookkeeper' && !['owner', 'accountant', 'bookkeeper'].includes(role)) {
    return <Navigate to="/" replace />;
  }

  // Flag gate — `flagEnabled` is boolean | undefined; we already
  // waited out undefined above.
  if (flagEnabled !== true) {
    return <Navigate to="/" replace />;
  }

  const currentLabel = PRACTICE_NAV_CATALOG.find((i) => i.path === location.pathname)?.label ?? 'Practice';

  return (
    <div className="p-6">
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-1.5 text-sm text-gray-500">
          <li>Practice</li>
          <li aria-hidden="true"><ChevronRight className="h-4 w-4" /></li>
          <li aria-current="page" className="font-medium text-gray-900">{currentLabel}</li>
        </ol>
      </nav>
      {children}
    </div>
  );
}
