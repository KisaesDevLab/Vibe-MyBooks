// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { Navigate } from 'react-router-dom';
import { useMe } from '../../../api/hooks/useAuth';
import { useFirms } from '../../../api/hooks/useFirms';
import { useFeatureFlag } from '../../../api/hooks/useFeatureFlag';
import { useUncategorizedMode } from '../../../api/hooks/useUncategorized';
import { isFirmOnlyEligible, type StaffRole } from '../../../hooks/usePracticeVisibility';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { TeamUncategorizedPage } from './TeamUncategorizedPage';

// Banking → Uncategorized: the team-member half of the uncategorized
// workflow (mirror of BankingRulesRoute). Practice → Uncategorized is for
// the firm that manages the books; everyone else on the tenant lands here
// and SUGGESTS a category for what is sitting in suspense.
//   - client user_type / readonly / flag-off / no banking permission → home
//   - firm members + super admins whom the server also calls reviewers →
//     /practice/uncategorized (the full page)
//   - everyone else → the suggest-only page (owners of self-managed books
//     also get a Suggested tab there, per the server's /mode answer)
// The server's /mode is the tie-breaker: the sidebar knows "member of ANY
// firm", the API knows "member of the firm managing THIS tenant".
export function BankingUncategorizedRoute() {
  const { data: meData, isLoading: meLoading } = useMe();
  const { data: firmsData, isLoading: firmsLoading } = useFirms();
  const flagEnabled = useFeatureFlag('UNCATEGORIZED_REVIEW_V1');

  const role = meData?.user?.role as StaffRole;
  const userType = (meData?.user as { userType?: 'staff' | 'client' } | undefined)?.userType ?? 'staff';
  const isSuperAdmin = !!(meData?.user as { isSuperAdmin?: boolean } | undefined)?.isSuperAdmin;
  const eligible = !!meData && userType !== 'client' && role !== 'readonly' && !!role && flagEnabled === true;
  const mode = useUncategorizedMode(eligible);

  if (meLoading || firmsLoading || flagEnabled === undefined || (eligible && mode.isLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // 403 (no banking permission) or 404 (flag off server-side) → home.
  if (!eligible || mode.isError || !mode.data) {
    return <Navigate to="/" replace />;
  }

  const firmSide = isFirmOnlyEligible(isSuperAdmin, (firmsData?.firms ?? []).length > 0);
  if (firmSide && mode.data.mode === 'review') {
    return <Navigate to="/practice/uncategorized" replace />;
  }

  return (
    <div className="p-6">
      <TeamUncategorizedPage mode={mode.data} />
    </div>
  );
}
