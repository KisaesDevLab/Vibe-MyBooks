// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Route guard that gates a page on a per-resource permission. Sits
// alongside AdminRoute / StaffWriteRoute. When the user lacks the
// required access we redirect to '/' rather than render a 403 — same
// posture as the other guards, keeping the surface invisible. The
// backend still enforces; this only avoids showing a page the user
// can't use.

import { Navigate } from 'react-router-dom';
import type { ResourceKey, PermissionAction } from '@kis-books/shared';
import { usePermissions } from '../../api/hooks/usePermissions';

interface RequirePermissionProps {
  resource: ResourceKey;
  action?: PermissionAction;
  children: React.ReactNode;
}

export function RequirePermission({ resource, action = 'read', children }: RequirePermissionProps) {
  const { can, ready } = usePermissions();
  // Wait for /me before deciding, so we don't bounce on a cold load.
  if (ready && !can(resource, action)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
