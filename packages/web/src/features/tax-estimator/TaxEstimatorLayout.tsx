// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Route guard for /tax-estimator/* — DOM-absent nav is not enough, deep links
// must bounce too. The API 404s the same cases independently.

import { Navigate, Outlet } from 'react-router-dom';
import { useTaxEstimatorVisibility } from '../../hooks/useTaxEstimatorVisibility';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

export function TaxEstimatorLayout() {
  const { ready, showGroup } = useTaxEstimatorVisibility();
  if (!ready) return <LoadingSpinner className="py-16" />;
  if (!showGroup) return <Navigate to="/" replace />;
  return <Outlet />;
}
