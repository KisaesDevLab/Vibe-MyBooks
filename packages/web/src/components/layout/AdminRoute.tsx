// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Navigate } from 'react-router-dom';
import { useMe } from '../../api/hooks/useAuth';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { data: meData } = useMe();

  if (meData && !meData.user?.isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
