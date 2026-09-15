// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { Navigate } from 'react-router-dom';
import type { FirmCapabilityKey } from '@kis-books/shared';
import { useMe } from '../../api/hooks/useAuth';
import { useFirmCapabilities } from '../../api/hooks/useFirmCapabilities';

interface AdminRouteProps {
  children: React.ReactNode;
  // When set, a firm member holding this delegated admin capability may
  // enter as well as super admins. Routes without it stay super-admin
  // only. Mirrors requireAdminCapability on the API.
  capability?: FirmCapabilityKey;
}

// Children render while /me is still loading (their own fetches 403
// harmlessly), so a cold load never flash-redirects a legitimate admin.
export function AdminRoute({ children, capability }: AdminRouteProps) {
  const { data: meData } = useMe();
  const { hasAdminCap } = useFirmCapabilities();

  if (meData) {
    const allowed = meData.user?.isSuperAdmin === true || (!!capability && hasAdminCap(capability));
    if (!allowed) return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// /admin index: super admins get the dashboard (which reads super-only
// stats); a delegated member is sent to the first admin page they may
// use; everyone else bounces home.
export function AdminIndexRoute({ children }: { children: React.ReactNode }) {
  const { data: meData } = useMe();
  const { hasAdminCap } = useFirmCapabilities();

  if (!meData) return <>{children}</>;
  if (meData.user?.isSuperAdmin) return <>{children}</>;
  if (hasAdminCap('admin_tenant_ops')) return <Navigate to="/admin/tenants" replace />;
  if (hasAdminCap('admin_user_support')) return <Navigate to="/admin/users" replace />;
  return <Navigate to="/" replace />;
}
