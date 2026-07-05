// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ACCOUNT_TYPES,
  DETAIL_TYPES,
  formatDetailTypeLabel,
  type AccountType,
  type CreateDetailTypeInput,
  type CustomDetailType,
  type DetailTypeOption,
  type MergedDetailTypes,
  type UpdateDetailTypeInput,
} from '@kis-books/shared';
import { apiClient } from '../client';

interface DetailTypesResponse {
  detailTypes: MergedDetailTypes;
  custom: CustomDetailType[];
}

// Static fallback: the built-in DETAIL_TYPES shaped like the merged API
// response. Used while loading and when the fetch fails (e.g. the user
// lacks company_settings read) so the account forms always have options.
function builtinMerged(): MergedDetailTypes {
  const merged = {} as MergedDetailTypes;
  for (const type of ACCOUNT_TYPES) {
    merged[type] = (DETAIL_TYPES[type] || []).map((value): DetailTypeOption => ({
      value,
      label: formatDetailTypeLabel(value),
      isCustom: false,
      id: null,
    }));
  }
  return merged;
}

/**
 * Merged builtin + tenant-custom detail types per account type, with the
 * static builtin list as a fallback. `detailTypes` is always populated —
 * callers can index it by account type without guarding on load state.
 */
export function useDetailTypes() {
  const query = useQuery({
    queryKey: ['detail-types'],
    queryFn: () => apiClient<DetailTypesResponse>('/tenant-settings/detail-types'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const detailTypes = useMemo<MergedDetailTypes>(
    () => query.data?.detailTypes ?? builtinMerged(),
    [query.data],
  );

  return {
    ...query,
    detailTypes,
    custom: query.data?.custom ?? [],
    optionsFor: (type: AccountType): DetailTypeOption[] => detailTypes[type] ?? [],
  };
}

export function useCreateDetailType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDetailTypeInput) =>
      apiClient<CustomDetailType>('/tenant-settings/detail-types', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['detail-types'] }),
  });
}

/**
 * PATCH one custom detail type (label rename / sortOrder reorder).
 * A multi-row reorder (see DetailTypesPage) awaits its PATCHes
 * sequentially; the per-success invalidation coalesces into one
 * refetch at the end.
 */
export function useUpdateDetailType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateDetailTypeInput & { id: string }) =>
      apiClient<CustomDetailType>(`/tenant-settings/detail-types/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['detail-types'] }),
  });
}

export function useDeleteDetailType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<void>(`/tenant-settings/detail-types/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['detail-types'] }),
  });
}
