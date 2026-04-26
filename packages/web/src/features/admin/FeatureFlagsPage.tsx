// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PRACTICE_FEATURE_FLAGS,
  type PracticeFeatureFlagKey,
  type FeatureFlagStatus,
  type FeatureFlagsResponse,
} from '@kis-books/shared';
import { apiClient } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';

interface TenantOption { id: string; name: string }

interface FlagListResponse {
  flags: Record<PracticeFeatureFlagKey, FeatureFlagStatus>;
}

// Super-admin surface for toggling Practice feature flags per
// tenant. The admin menu link at /admin/feature-flags is the only
// entry point. The GET endpoint we'd normally call
// (`/api/v1/feature-flags`) is tenant-scoped — it returns flags
// for the caller's active tenant. Super-admin needs per-tenant
// visibility, so we take a tenant id and read the admin version
// of the list. For Phase 1 we reuse the public GET endpoint by
// switching the caller's tenant via the existing switch-tenant
// path — but that has side-effects, so instead we expose a
// super-admin GET at /admin/feature-flags/:tenantId (server-side
// listing alongside the toggle POST). Implemented here with a
// fallback: if the per-tenant GET isn't available yet, hit
// `/feature-flags` after switching tenant via `/admin/tenants` —
// Phase 1 wires the simpler per-tenant GET.
export function FeatureFlagsPage() {
  const queryClient = useQueryClient();
  const [tenantId, setTenantId] = useState<string>('');

  const { data: tenantOptions } = useQuery({
    queryKey: ['admin', 'tenants-for-flags'],
    queryFn: async () => {
      const res = await apiClient<{ tenants: TenantOption[] }>('/admin/tenants');
      return res.tenants;
    },
  });

  const { data: flagsResp, isLoading } = useQuery({
    queryKey: ['admin', 'feature-flags', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      return apiClient<FeatureFlagListResponse>(`/admin/feature-flags/${tenantId}`);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ key, enabled }: { key: PracticeFeatureFlagKey; enabled: boolean }) => {
      return apiClient(`/admin/feature-flags/${tenantId}/${key}`, {
        method: 'POST',
        body: JSON.stringify({ enabled }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feature-flags', tenantId] });
      // Also invalidate the current user's own flag cache in case
      // they're toggling flags for their own tenant.
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
  });

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-2">Feature Flags</h1>
      <p className="text-gray-600 mb-6">
        Toggle Practice Management features per tenant. Flags default ON for newly-created tenants and OFF for tenants that existed before the Practice foundation shipped.
      </p>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="tenant-select">
          Tenant
        </label>
        <select
          id="tenant-select"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          className="block w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Select a tenant…</option>
          {(tenantOptions ?? []).map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {tenantId && isLoading && <LoadingSpinner className="py-12" />}

      {tenantId && flagsResp && (
        <div className="space-y-2">
          {PRACTICE_FEATURE_FLAGS.map((key) => {
            const status = flagsResp.flags[key] ?? { enabled: false, rolloutPercent: 0, activatedAt: null };
            return (
              <div
                key={key}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900 font-mono">{key}</div>
                  <div className="text-xs text-gray-500">
                    {status.activatedAt
                      ? `First activated ${new Date(status.activatedAt).toLocaleString()}`
                      : 'Never activated'}
                  </div>
                </div>
                <Button
                  variant={status.enabled ? 'secondary' : 'primary'}
                  onClick={() => toggleMutation.mutate({ key, enabled: !status.enabled })}
                  disabled={toggleMutation.isPending}
                >
                  {status.enabled ? 'Disable' : 'Enable'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Local type alias so I don't have to restate the generic each call
// site. Equivalent to FeatureFlagsResponse but narrower.
type FeatureFlagListResponse = FeatureFlagsResponse;
