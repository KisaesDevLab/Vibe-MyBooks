// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useMemo } from 'react';
import type { FirmCapabilityKey, FirmCapabilityMap } from '@kis-books/shared';
import { useMe } from './useAuth';

const EMPTY: FirmCapabilityMap = {};

// Firm member access rights, as resolved by the server on /auth/me.
//
// Fails CLOSED: an absent map (still loading, or a pre-capability server)
// grants nothing. Unlike usePermissions — which fails open because it only
// ever HIDES things the user already had — this hook only ever ADDS access,
// so closed is the safe default. The server re-checks every call anyway;
// the UI reads this map only to show what the server would accept.
export function useFirmCapabilities() {
  const { data: meData } = useMe();
  const tenant = meData?.firmCapabilities?.tenant ?? EMPTY;
  const admin = meData?.firmCapabilities?.admin ?? EMPTY;
  const isSuperAdmin = meData?.user?.isSuperAdmin === true;
  const isOwner = meData?.user?.role === 'owner';

  return useMemo(() => {
    const hasTenantCap = (key: FirmCapabilityKey) => tenant[key] === true;
    const hasAdminCap = (key: FirmCapabilityKey) => admin[key] === true;
    // Any delegated admin capability → the Admin section is reachable.
    const isDelegatedAdmin = !isSuperAdmin
      && (hasAdminCap('admin_tenant_ops') || hasAdminCap('admin_user_support'));
    // The "owner-only tenant action" rule, mirroring the backend
    // requireTenantCapability guard: owner OR super admin OR capability.
    const canOwnerAction = (key: FirmCapabilityKey) => isOwner || isSuperAdmin || hasTenantCap(key);
    return {
      tenant,
      admin,
      hasTenantCap,
      hasAdminCap,
      isDelegatedAdmin,
      canOwnerAction,
      isOwner,
      isSuperAdmin,
      ready: !!meData,
    };
  }, [tenant, admin, isOwner, isSuperAdmin, meData]);
}
