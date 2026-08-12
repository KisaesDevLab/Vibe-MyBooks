// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Staff-side hooks for bank connection invites (BANK_CONNECT_INVITES_V1):
// list/create/resend/revoke against the authenticated /plaid/invites
// endpoints. The client-facing public flow uses raw fetch against
// /api/bank-connect (see features/public/BankConnectPage.tsx).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface BankConnectInviteRow {
  id: string;
  kind: 'connect' | 'repair';
  autoSent: boolean;
  recipientName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  status: 'sent' | 'viewed' | 'connected' | 'expired' | 'revoked';
  sentVia: 'email' | 'sms' | 'both';
  sentAt: string;
  expiresAt: string;
  viewedAt: string | null;
  connectedAt: string | null;
  connectedPlaidItemId: string | null;
  connectionsCount: number;
  createdByName: string | null;
}

export interface CreateInviteInput {
  recipientName: string;
  email?: string;
  phone?: string;
  companyId?: string;
  message?: string;
}

const KEY = ['bank-connect-invites'];

export function useBankConnectInvites(opts: { limit?: number; offset?: number } = {}) {
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  return useQuery({
    queryKey: [...KEY, limit, offset],
    queryFn: () => apiClient<{ invites: BankConnectInviteRow[]; total: number }>(
      `/plaid/invites?limit=${limit}&offset=${offset}`,
    ),
  });
}

export function useCreateBankConnectInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInviteInput) =>
      apiClient<{ inviteId: string; channels: Array<'email' | 'sms'> }>(
        '/plaid/invites', { method: 'POST', body: JSON.stringify(input) },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useResendBankConnectInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ channels: Array<'email' | 'sms'> }>(`/plaid/invites/${id}/resend`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRevokeBankConnectInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<{ revoked: boolean }>(`/plaid/invites/${id}/revoke`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
