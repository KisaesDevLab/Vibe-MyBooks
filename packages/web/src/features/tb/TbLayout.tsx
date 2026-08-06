// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Route guard for /tb/* — mirrors PracticeLayout's role: DOM-absent
// nav is not enough, deep links must bounce too. Server routes 404
// client-type users independently; this is the UX-side redirect.

import { Navigate, Outlet } from 'react-router-dom';
import { useTrialBalanceVisibility } from '../../hooks/useTrialBalanceVisibility';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export function TbLayout() {
  const { ready, showGroup } = useTrialBalanceVisibility();
  if (!ready) return <LoadingSpinner className="py-16" />;
  if (!showGroup) return <Navigate to="/" replace />;
  return <Outlet />;
}
