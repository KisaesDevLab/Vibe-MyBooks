// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// React-query hooks for peer screen share.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../api/client';

export interface ShareCapabilities {
  canShare: boolean;
  canView: boolean;
}

export interface CreateSessionResponse {
  sessionId: string;
  joinCode: string; // shown once, never re-retrievable
  expiresAt: string;
}

export interface ShareParticipantView {
  id: string;
  viewerName: string;
  viewerFirmName: string;
  status: 'requested' | 'approved' | 'denied' | 'lapsed' | 'ejected' | 'left';
  isCrossFirm: boolean;
  scopeWarningShown?: boolean;
  requestedAt: string;
  approvedAt: string | null;
  endedAt: string | null;
}

export interface ShareSessionView {
  session: {
    id: string;
    status: 'pending' | 'active' | 'ended' | 'expired' | 'revoked';
    entityContext: string | null;
    createdAt: string;
    endedAt: string | null;
    expiresAt: string;
    endedReason: string | null;
  };
  participants: ShareParticipantView[];
  role: 'sharer' | 'viewer' | 'admin';
}

export interface ApprovalContextView {
  participantId: string;
  status: string;
  viewerName: string;
  viewerEmail: string;
  viewerFirmName: string;
  isCrossFirm: boolean;
  viewerHasEntityAccess: boolean | null;
  entityName: string | null;
  requestedAt: string;
  approvalWindowSeconds: number;
}

export interface JoinRequestResponse {
  participantId: string;
  sessionId: string;
  sharerName: string;
  approvalWindowSeconds: number;
}

/** Feature probe. 404 = feature off for this user (server never reveals
 *  whether it exists) — surfaced as `enabled: false`. */
export function useShareCapabilities() {
  return useQuery({
    queryKey: ['share', 'capabilities'],
    queryFn: async (): Promise<ShareCapabilities & { enabled: boolean }> => {
      try {
        const caps = await apiClient<ShareCapabilities>('/share/capabilities');
        return { ...caps, enabled: true };
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return { canShare: false, canView: false, enabled: false };
        }
        throw err;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useCreateShareSession() {
  return useMutation({
    mutationFn: (entityContext: string | null) =>
      apiClient<CreateSessionResponse>('/share/sessions', {
        method: 'POST',
        body: JSON.stringify({ entityContext }),
      }),
  });
}

export function useShareSession(sessionId: string | null, opts: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: ['share', 'session', sessionId],
    queryFn: () => apiClient<ShareSessionView>(`/share/sessions/${sessionId}`),
    enabled: !!sessionId,
    refetchInterval: opts.poll ? 2000 : false,
  });
}

export function useRequestJoin() {
  return useMutation({
    mutationFn: (code: string) =>
      apiClient<JoinRequestResponse>('/share/sessions/request', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
  });
}

export function useApprovalContext(sessionId: string | null, participantId: string | null) {
  return useQuery({
    queryKey: ['share', 'approval-context', sessionId, participantId],
    queryFn: () =>
      apiClient<ApprovalContextView>(`/share/sessions/${sessionId}/participants/${participantId}/context`),
    enabled: !!sessionId && !!participantId,
    staleTime: 10_000,
  });
}

export function useApproveParticipant(sessionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { participantId: string; crossFirmConfirmed?: boolean; scopeWarningConfirmed?: boolean }) =>
      apiClient(`/share/sessions/${sessionId}/participants/${input.participantId}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          crossFirmConfirmed: input.crossFirmConfirmed,
          scopeWarningConfirmed: input.scopeWarningConfirmed,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['share', 'session', sessionId] }),
  });
}

export function useDenyParticipant(sessionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (participantId: string) =>
      apiClient(`/share/sessions/${sessionId}/participants/${participantId}/deny`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['share', 'session', sessionId] }),
  });
}

export function useEjectParticipant(sessionId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (participantId: string) =>
      apiClient(`/share/sessions/${sessionId}/participants/${participantId}/eject`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['share', 'session', sessionId] }),
  });
}

export function useEndShareSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => apiClient(`/share/sessions/${sessionId}/end`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['share'] }),
  });
}

export function useExtendShareSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      apiClient<{ expiresAt: string }>(`/share/sessions/${sessionId}/extend`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['share'] }),
  });
}

export const fetchSharerTicket = (sessionId: string) =>
  apiClient<{ ticket: string }>(`/share/sessions/${sessionId}/ticket`, { method: 'POST' }).then((r) => r.ticket);

export const fetchViewerTicket = (participantId: string) =>
  apiClient<{ ticket: string }>(`/share/participants/${participantId}/ticket`, { method: 'POST' }).then((r) => r.ticket);

// ── Admin ──────────────────────────────────────────────────────────────────

export interface AdminShareSessionRow {
  session: {
    id: string;
    status: string;
    createdAt: string;
    endedAt: string | null;
    endedReason: string | null;
    entityContext: string | null;
    bytesRelayed: number;
  };
  sharerName: string;
  participants: ShareParticipantView[];
}

export function useAdminShareSessions(filters: { crossFirmOnly?: boolean } = {}) {
  return useQuery({
    queryKey: ['share', 'admin-sessions', filters],
    queryFn: () =>
      apiClient<{ sessions: AdminShareSessionRow[] }>(
        `/share/admin/sessions${filters.crossFirmOnly ? '?crossFirm=1' : ''}`,
      ),
  });
}

export interface TenantShareSettingsView {
  enabled?: boolean | null;
  allowInboundCrossFirm?: boolean;
  globalEnabled: boolean;
}

export function useTenantShareSettings() {
  return useQuery({
    queryKey: ['share', 'tenant-settings'],
    queryFn: () => apiClient<TenantShareSettingsView>('/share/admin/settings'),
    retry: false,
  });
}

export function useUpdateTenantShareSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: { enabled?: boolean | null; allowInboundCrossFirm?: boolean }) =>
      apiClient<TenantShareSettingsView>('/share/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['share', 'tenant-settings'] }),
  });
}

export function useMyShareHistory() {
  return useQuery({
    queryKey: ['share', 'mine'],
    queryFn: () => apiClient<{ shared: unknown[]; viewed: unknown[] }>('/share/sessions/mine'),
  });
}
