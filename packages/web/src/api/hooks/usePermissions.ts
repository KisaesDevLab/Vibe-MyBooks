// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import {
  can as sharedCan,
  type ResourceKey,
  type PermissionAction,
  type EffectivePermissions,
} from '@kis-books/shared';
import { useMe } from './useAuth';

// Single UI entry point for permission checks. Reads the effective map
// the server computed for /auth/me and applies the same `can()` used by
// the backend guards, so what the UI hides is exactly what the API
// would reject.
//
// When the map is absent (still loading, or a pre-permission server) we
// fail OPEN — the UI shows the control and the backend remains the real
// gate. Failing closed would flash an empty app on every cold load.
export function usePermissions() {
  const { data: meData } = useMe();
  const permissions: EffectivePermissions | undefined = meData?.permissions;

  const can = (resource: ResourceKey, action: PermissionAction = 'read'): boolean => {
    if (!permissions) return true;
    return sharedCan(permissions, resource, action);
  };

  return { permissions, can, ready: !!meData };
}
