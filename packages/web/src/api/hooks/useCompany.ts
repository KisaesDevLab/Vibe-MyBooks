// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Company, UpdateCompanyInput, CompanySettings } from '@kis-books/shared';
import { apiClient, API_BASE } from '../client';

export function useCompany() {
  return useQuery({
    queryKey: ['company'],
    queryFn: () => apiClient<{ company: Company }>('/company'),
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCompanyInput) =>
      apiClient<{ company: Company }>('/company', {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company'] }),
  });
}

export function useUploadLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await fetch(`${API_BASE}/company/logo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company'] }),
  });
}

export function useCompanySettings() {
  return useQuery({
    queryKey: ['company', 'settings'],
    queryFn: () => apiClient<{ settings: CompanySettings }>('/company/settings'),
  });
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CompanySettings>) =>
      apiClient('/company/settings', {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company'] }),
  });
}

export function useMarkSetupComplete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient('/company/setup-complete', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company'] }),
  });
}
