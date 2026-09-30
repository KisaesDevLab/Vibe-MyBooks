// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Deep-link guard for /tb/financial-statements/* (TbLayout already
// enforces TRIAL_BALANCE_V1 + staff); this adds FINANCIAL_STATEMENTS_V1.

import { Navigate, Outlet } from 'react-router-dom';
import { useFeatureFlags } from '../../../api/hooks/useFeatureFlag';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

export function FsRouteGuard() {
  const { data, isLoading } = useFeatureFlags();
  if (isLoading || !data) return <LoadingSpinner className="py-16" />;
  if (data.flags?.['FINANCIAL_STATEMENTS_V1']?.enabled !== true) return <Navigate to="/tb/workpaper" replace />;
  return <Outlet />;
}
