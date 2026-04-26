// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery } from '@tanstack/react-query';
import type { FeatureFlagsResponse, PracticeFeatureFlagKey } from '@kis-books/shared';
import { apiClient } from '../client';

// Eight Practice flags live on the server. The sidebar needs to
// know all of them at once to decide which children to render, so a
// single cached fetch is cheaper than one per flag. 5-minute
// staleTime keeps the bundle stable during a normal working
// session; flag toggles from the admin UI invalidate the query
// explicitly via useSetFeatureFlag.
const FEATURE_FLAGS_KEY = ['feature-flags'] as const;

export function useFeatureFlags() {
  return useQuery({
    queryKey: FEATURE_FLAGS_KEY,
    queryFn: () => apiClient<FeatureFlagsResponse>('/feature-flags'),
    staleTime: 5 * 60 * 1000,
    enabled: !!localStorage.getItem('accessToken'),
  });
}

// Single-flag convenience. Returns `undefined` while loading so
// consumers can distinguish "unknown yet" from a confirmed false.
export function useFeatureFlag(key: PracticeFeatureFlagKey): boolean | undefined {
  const { data } = useFeatureFlags();
  if (!data) return undefined;
  return data.flags[key]?.enabled ?? false;
}
