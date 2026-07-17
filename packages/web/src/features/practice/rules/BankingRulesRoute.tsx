// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { Navigate } from 'react-router-dom';
import { useMe } from '../../../api/hooks/useAuth';
import { useFirms } from '../../../api/hooks/useFirms';
import { useFeatureFlag } from '../../../api/hooks/useFeatureFlag';
import { isPracticeStaff, type StaffRole } from '../../../hooks/usePracticeVisibility';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { RulesPage } from './RulesPage';

// Non-firm users lost the Practice → Rules link when firm-staff
// surfaces were locked down, but a solo/self-signup owner still
// needs to manage their own bank-categorization rules. This route
// exposes the Rules page under Banking for exactly those users:
//   - client user_type / readonly / flag-off  → bounced home
//   - actual practice staff (super admin, accountant/bookkeeper,
//     or a firm member) → redirected to the full /practice/rules
//     (they keep every tier + transition there)
//   - everyone else (a bare tenant owner) → the Banking variant,
//     which shows only Mine + Firm and is view-only for Firm.
export function BankingRulesRoute() {
  const { data: meData, isLoading: meLoading } = useMe();
  const { data: firmsData, isLoading: firmsLoading } = useFirms();
  const flagEnabled = useFeatureFlag('CONDITIONAL_RULES_V1');

  if (meLoading || firmsLoading || flagEnabled === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const role = meData?.user?.role as StaffRole;
  const userType = (meData?.user as { userType?: 'staff' | 'client' } | undefined)?.userType ?? 'staff';
  const isSuperAdmin = !!(meData?.user as { isSuperAdmin?: boolean } | undefined)?.isSuperAdmin;

  // Clients use the portal, readonly can't author, and the feature
  // may be off for this tenant — none of them belong here.
  if (userType === 'client' || role === 'readonly' || !role || flagEnabled !== true) {
    return <Navigate to="/" replace />;
  }

  // Real staff get the full practice page instead of the restricted view.
  if (isPracticeStaff(role, isSuperAdmin, (firmsData?.firms ?? []).length > 0)) {
    return <Navigate to="/practice/rules" replace />;
  }

  return (
    <div className="p-6">
      <RulesPage variant="banking" />
    </div>
  );
}
