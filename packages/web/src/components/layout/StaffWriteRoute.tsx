// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Route guard for "any tenant staffer who can post to the GL" — i.e.
// owner / accountant / bookkeeper. Mirrors the backend's
// `requireStaffWrite` middleware in routes/imports.routes.ts. Used by
// pages like Bulk Import that aren't super-admin-restricted but still
// shouldn't be reachable by readonly accounts or portal clients.
//
// Stricter than ProtectedRoute (which gates on authentication only),
// looser than AdminRoute (which gates on isSuperAdmin). When a user
// fails the check we redirect to '/' rather than rendering a 403 —
// matches AdminRoute's posture and keeps the surface invisible to
// callers who shouldn't see it.

import { Navigate } from 'react-router-dom';
import { useMe } from '../../api/hooks/useAuth';

interface StaffWriteRouteProps {
  children: React.ReactNode;
}

export function StaffWriteRoute({ children }: StaffWriteRouteProps) {
  const { data: meData } = useMe();

  if (meData?.user) {
    const { role, userType } = meData.user;
    const isClient = userType === 'client';
    const isReadonly = role === 'readonly';
    if (isClient || isReadonly) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}
