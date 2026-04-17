// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateBillInput,
  CreateVendorCreditInput,
  PayBillsInput,
  BillFilters,
  Transaction,
  BillSummary,
  VendorCreditSummary,
} from '@kis-books/shared';
import { apiClient } from '../client';

// ─── Bills ──────────────────────────────────────────────────────

interface BillListRow extends BillSummary {
  status: string;
  createdAt: string;
}

export function useBills(filters?: BillFilters) {
  const params = new URLSearchParams();
  if (filters?.contactId) params.set('contactId', filters.contactId);
  if (filters?.billStatus) params.set('billStatus', filters.billStatus);
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);
  if (filters?.dueOnOrBefore) params.set('dueOnOrBefore', filters.dueOnOrBefore);
  if (filters?.overdueOnly) params.set('overdueOnly', String(filters.overdueOnly));
  if (filters?.search) params.set('search', filters.search);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));

  const qs = params.toString();
  return useQuery({
    queryKey: ['bills', filters],
    queryFn: () => apiClient<{ data: BillListRow[]; total: number }>(`/bills${qs ? `?${qs}` : ''}`),
  });
}

export function useBill(id: string) {
  return useQuery({
    queryKey: ['bills', id],
    queryFn: () => apiClient<{ bill: Transaction }>(`/bills/${id}`),
    enabled: !!id,
  });
}

export function useCreateBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBillInput) =>
      apiClient<{ bill: Transaction }>('/bills', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

export function useUpdateBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateBillInput }) =>
      apiClient<{ bill: Transaction }>(`/bills/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['bills', vars.id] });
    },
  });
}

export function useVoidBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient(`/bills/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function usePayableBills(opts?: { contactId?: string; dueOnOrBefore?: string }) {
  const params = new URLSearchParams();
  if (opts?.contactId) params.set('contactId', opts.contactId);
  if (opts?.dueOnOrBefore) params.set('dueOnOrBefore', opts.dueOnOrBefore);
  const qs = params.toString();
  return useQuery({
    queryKey: ['bills', 'payable', opts],
    queryFn: () => apiClient<{ bills: BillSummary[]; credits: VendorCreditSummary[] }>(
      `/bills/payable${qs ? `?${qs}` : ''}`,
    ),
  });
}

// ─── Vendor Credits ─────────────────────────────────────────────

export function useVendorCredits(filters?: { contactId?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (filters?.contactId) params.set('contactId', filters.contactId);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  const qs = params.toString();
  return useQuery({
    queryKey: ['vendor-credits', filters],
    queryFn: () => apiClient<{ data: any[]; total: number }>(`/vendor-credits${qs ? `?${qs}` : ''}`),
  });
}

export function useVendorCredit(id: string) {
  return useQuery({
    queryKey: ['vendor-credits', id],
    queryFn: () => apiClient<{ credit: Transaction }>(`/vendor-credits/${id}`),
    enabled: !!id,
  });
}

export function useCreateVendorCredit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVendorCreditInput) =>
      apiClient<{ credit: Transaction }>('/vendor-credits', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-credits'] });
      qc.invalidateQueries({ queryKey: ['bills', 'payable'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export function useVoidVendorCredit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient(`/vendor-credits/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-credits'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

// ─── Bill Payments ──────────────────────────────────────────────

export function usePayBills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PayBillsInput) =>
      apiClient<{ payments: Array<Transaction & { netPayment: string; billsPaid: number; creditsApplied: number }> }>(
        '/bill-payments',
        { method: 'POST', body: JSON.stringify(input) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['vendor-credits'] });
      qc.invalidateQueries({ queryKey: ['bill-payments'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
      qc.invalidateQueries({ queryKey: ['print-queue'] });
    },
  });
}

export function useBillPayment(id: string) {
  return useQuery({
    queryKey: ['bill-payments', id],
    queryFn: () => apiClient<{ payment: any }>(`/bill-payments/${id}`),
    enabled: !!id,
  });
}

export function useVoidBillPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient(`/bill-payments/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['vendor-credits'] });
      qc.invalidateQueries({ queryKey: ['bill-payments'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
