// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  TailscaleStatus,
  TailscaleHealth,
  TailscaleActionResult,
  TailscaleServeStatus,
  TailscaleAuditEntry,
  TailscaleConnectInput,
  TailscaleAuditFilters,
  TailscaleUpdateCheck,
} from '@kis-books/shared';
import { apiClient } from '../client';

export const tailscaleKeys = {
  all: ['tailscale'] as const,
  status: () => [...tailscaleKeys.all, 'status'] as const,
  health: () => [...tailscaleKeys.all, 'health'] as const,
  serve: () => [...tailscaleKeys.all, 'serve'] as const,
  updateCheck: () => [...tailscaleKeys.all, 'update-check'] as const,
  audit: (filters: Partial<TailscaleAuditFilters>) =>
    [...tailscaleKeys.all, 'audit', filters] as const,
};

export function useTailscaleStatus() {
  return useQuery({
    queryKey: tailscaleKeys.status(),
    queryFn: () => apiClient<TailscaleStatus>('/admin/tailscale/status'),
    refetchInterval: 10_000,
  });
}

export function useTailscaleHealth() {
  return useQuery({
    queryKey: tailscaleKeys.health(),
    queryFn: () => apiClient<TailscaleHealth>('/admin/tailscale/health'),
    refetchInterval: 60_000,
  });
}

export function useTailscaleUpdateCheck() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: tailscaleKeys.updateCheck(),
    queryFn: () => apiClient<TailscaleUpdateCheck>('/admin/tailscale/update-check'),
    staleTime: 60 * 60 * 1000,
  });
  const refresh = () =>
    apiClient<TailscaleUpdateCheck>('/admin/tailscale/update-check?refresh=1').then((data) => {
      qc.setQueryData(tailscaleKeys.updateCheck(), data);
      return data;
    });
  return { ...query, refresh };
}

export function useTailscaleServe() {
  return useQuery({
    queryKey: tailscaleKeys.serve(),
    queryFn: () => apiClient<TailscaleServeStatus>('/admin/tailscale/serve'),
    refetchInterval: 30_000,
  });
}

export function useTailscaleAudit(filters: Partial<TailscaleAuditFilters>) {
  return useQuery({
    queryKey: tailscaleKeys.audit(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== '') params.set(key, String(value));
      }
      const qs = params.toString();
      return apiClient<{
        entries: TailscaleAuditEntry[];
        total: number;
        page: number;
        limit: number;
      }>(`/admin/tailscale/audit${qs ? `?${qs}` : ''}`);
    },
  });
}

export function useTailscaleConnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TailscaleConnectInput) =>
      apiClient<TailscaleActionResult>('/admin/tailscale/connect', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tailscaleKeys.all });
    },
  });
}

export function useTailscaleDisconnect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient<TailscaleActionResult>('/admin/tailscale/disconnect', {
        method: 'POST',
        body: JSON.stringify({ confirmation: 'CONFIRM' }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tailscaleKeys.all });
    },
  });
}

export function useTailscaleReauth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiClient<TailscaleActionResult>('/admin/tailscale/reauth', { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tailscaleKeys.all });
    },
  });
}

export function useTailscaleEnableServe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetPort: number) =>
      apiClient<TailscaleServeStatus>('/admin/tailscale/serve', {
        method: 'POST',
        body: JSON.stringify({ targetPort }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tailscaleKeys.serve() });
    },
  });
}

export function useTailscaleDisableServe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient<TailscaleServeStatus>('/admin/tailscale/serve', { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: tailscaleKeys.serve() });
    },
  });
}
