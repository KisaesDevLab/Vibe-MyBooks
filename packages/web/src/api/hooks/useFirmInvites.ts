// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// "Invite my accountant" hooks. Owner side (list/create/resend/revoke)
// against /firm-invites; staff side (lookup/accept) — secrets always in
// POST bodies, never URLs.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AcceptFirmInviteResult, FirmInvite, FirmInvitePreview } from '@kis-books/shared';
import { apiClient } from '../client';

const KEY = ['firm-invites'];

export interface FirmInviteListResponse {
  invites: FirmInvite[];
  managingFirm: { id: string; name: string } | null;
}

export function useFirmInvites(opts: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiClient<FirmInviteListResponse>('/firm-invites'),
    enabled: opts.enabled ?? true,
    staleTime: 30 * 1000,
  });
}

export interface CreateFirmInviteResponse {
  inviteId: string;
  expiresAt: string;
  sent: boolean;
  resent: boolean;
  error?: string;
}

export function useCreateFirmInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string }) =>
      apiClient<CreateFirmInviteResponse>('/firm-invites', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useResendFirmInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ expiresAt: string; sent: boolean; error?: string }>(`/firm-invites/${id}/resend`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRevokeFirmInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient<{ revoked: boolean }>(`/firm-invites/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export type FirmInviteLookup = { token: string } | { code: string };

export function useLookupFirmInvite() {
  return useMutation({
    mutationFn: (lookup: FirmInviteLookup) =>
      apiClient<FirmInvitePreview>('/firm-invites/lookup', { method: 'POST', body: JSON.stringify(lookup) }),
  });
}

export function useAcceptFirmInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FirmInviteLookup & { firmId?: string }) =>
      apiClient<AcceptFirmInviteResult>('/firm-invites/accept', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      // The acceptor now has a new tenant in their switcher and (maybe) a
      // new managed tenant on their firm page.
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['firms'] });
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
