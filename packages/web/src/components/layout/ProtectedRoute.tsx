// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Navigate, useLocation } from 'react-router-dom';
import { useMe } from '../../api/hooks/useAuth';
import { useCompany } from '../../api/hooks/useCompany';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { getAccessToken } from '../../api/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const token = getAccessToken();
  const location = useLocation();
  const { isLoading: meLoading, isError: meError, data: meData, fetchStatus: meFetchStatus } = useMe();
  const { data: companyData, isLoading: companyLoading } = useCompany();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Query is disabled (no token in localStorage yet) or still loading
  if (meLoading && meFetchStatus !== 'idle') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Only redirect to login if we actually tried to fetch and got an error
  if (meError && meFetchStatus !== 'idle') {
    return <Navigate to="/login" replace />;
  }

  // Wait for company data
  if (companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Only redirect to setup on first visit after registration
  const setupDismissed = sessionStorage.getItem('setupDismissed');
  if (
    companyData?.company &&
    !companyData.company.setupComplete &&
    !setupDismissed &&
    location.pathname !== '/setup'
  ) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}
