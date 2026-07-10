// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import type { ReactNode } from 'react';
import type { ResourceKey, PermissionAction } from '@kis-books/shared';
import { usePermissions } from '../../api/hooks/usePermissions';

// Declarative gate for a single control (button, menu item, section).
// Renders `children` only when the current user has `action` on
// `resource`; otherwise renders `fallback` (nothing by default).
//
//   <Can resource="invoices" action="create">
//     <Button onClick={...}>New Invoice</Button>
//   </Can>
export function Can({
  resource,
  action = 'read',
  fallback = null,
  children,
}: {
  resource: ResourceKey;
  action?: PermissionAction;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can } = usePermissions();
  return <>{can(resource, action) ? children : fallback}</>;
}
