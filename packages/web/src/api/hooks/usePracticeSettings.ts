// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClassificationThresholds,
  ClassificationThresholdsInput,
} from '@kis-books/shared';
import { apiClient } from '../client';

interface SettingsResponse {
  classificationThresholds: ClassificationThresholds;
}

export function useThresholds() {
  return useQuery({
    queryKey: ['practice', 'settings'],
    queryFn: () => apiClient<SettingsResponse>('/practice/settings'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useSetThresholds() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClassificationThresholdsInput) =>
      apiClient<SettingsResponse>('/practice/settings', {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practice', 'settings'] });
      // Thresholds change every bucket assignment at next upsert —
      // invalidate the classification data so UI reflects the new
      // bucket counts on the next interaction.
      qc.invalidateQueries({ queryKey: ['practice', 'classification'] });
    },
  });
}
