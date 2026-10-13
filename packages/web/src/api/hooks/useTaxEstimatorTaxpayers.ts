// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tax Estimator taxpayer hooks (MODULE.md D1). The server resolves the firm and
// the allowed-tenant set; the only thing sent is an optional X-Firm-Id for users
// in several firms (the server 404s a firm the caller does not belong to).
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import type {
  TaxpayerListDTO, TaxpayerDetailDTO, TaxpayerDTO, PersonDTO, LinkListDTO, LinkUpsertResultDTO,
  CompanyOptionListDTO, TaxpayerContactListDTO, TaxpayerContactCandidateListDTO, LinkContactResultDTO, UnlinkContactResultDTO,
  CreateTaxpayerInput, UpdateTaxpayerInput, UpsertPersonInput, UpsertLinkInput, PersonRole,
  TaxpayerStaffDTO, TaxpayerStaffCandidateListDTO, DependentDTO, UpsertDependentInput,
} from '@kis-books/shared';
import { apiClient } from '../client';

const BASE = '/tax-estimator/taxpayers';
const KEY = 'tax-estimator-taxpayers';
const FIRM_STORAGE_KEY = 'tax-estimator:firm-id';

export function getTaxEstimatorFirmId(): string | null {
  try { return localStorage.getItem(FIRM_STORAGE_KEY); } catch { return null; }
}
export function setTaxEstimatorFirmId(id: string | null) {
  try { if (id) localStorage.setItem(FIRM_STORAGE_KEY, id); else localStorage.removeItem(FIRM_STORAGE_KEY); } catch { /* ignore */ }
}

function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const firm = getTaxEstimatorFirmId();
  return apiClient<T>(`${BASE}${path}`, {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), ...(firm ? { 'X-Firm-Id': firm } : {}) },
  });
}

export interface TaxpayerListParams {
  q?: string;
  status?: 'active' | 'archived' | 'all';
  filingStatus?: string[];
  residentState?: string[];
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  limit: number;
  offset: number;
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export function useTaxpayers(p: TaxpayerListParams) {
  return useQuery({
    queryKey: [KEY, 'list', p],
    placeholderData: keepPreviousData,
    queryFn: () => call<TaxpayerListDTO>(qs({
      q: p.q, status: p.status, filingStatus: p.filingStatus?.join(','), residentState: p.residentState?.join(','), sortBy: p.sortBy, sortDir: p.sortDir,
      limit: p.limit, offset: p.offset,
    })),
  });
}

export function useTaxpayer(id: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'detail', id],
    enabled: !!id,
    queryFn: async () => (await call<{ data: TaxpayerDetailDTO }>(`/${id}`)).data,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: [KEY] });
}

export function useCreateTaxpayer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: CreateTaxpayerInput) =>
      (await call<{ data: TaxpayerDTO }>('', { method: 'POST', body: JSON.stringify(input) })).data,
    onSuccess: invalidate,
  });
}

export function useUpdateTaxpayer(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: UpdateTaxpayerInput) =>
      (await call<{ data: TaxpayerDTO }>(`/${id}`, { method: 'PATCH', body: JSON.stringify(input) })).data,
    onSuccess: invalidate,
  });
}

export function useArchiveTaxpayer() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) => (await call<{ data: TaxpayerDTO }>(`/${id}`, { method: 'DELETE' })).data,
    onSuccess: invalidate,
  });
}

export function useUpsertPerson(taxpayerId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { role: PersonRole; input: UpsertPersonInput }) =>
      (await call<{ data: PersonDTO }>(`/${taxpayerId}/persons/${v.role}`, { method: 'PUT', body: JSON.stringify(v.input) })).data,
    onSuccess: invalidate,
  });
}

export function useRemovePerson(taxpayerId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (role: PersonRole) =>
      (await call<{ data: { removedLinks: number } }>(`/${taxpayerId}/persons/${role}`, { method: 'DELETE' })).data,
    onSuccess: invalidate,
  });
}

// ── Q44 dependents (part of the taxpayer detail; the list comes back on GET /:id) ──
export function useCreateDependent(taxpayerId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: UpsertDependentInput) =>
      (await call<{ data: DependentDTO }>(`/${taxpayerId}/dependents`, { method: 'POST', body: JSON.stringify(input) })).data,
    onSuccess: invalidate,
  });
}

export function useUpdateDependent(taxpayerId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { id: string; input: UpsertDependentInput }) =>
      (await call<{ data: DependentDTO }>(`/${taxpayerId}/dependents/${v.id}`, { method: 'PUT', body: JSON.stringify(v.input) })).data,
    onSuccess: invalidate,
  });
}

export function useRemoveDependent(taxpayerId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: string) =>
      (await call<{ data: { removed: true } }>(`/${taxpayerId}/dependents/${id}`, { method: 'DELETE' })).data,
    onSuccess: invalidate,
  });
}

export function useTaxpayerLinks(taxpayerId: string | undefined, taxYear: number) {
  return useQuery({
    queryKey: [KEY, 'links', taxpayerId, taxYear],
    enabled: !!taxpayerId,
    queryFn: () => call<LinkListDTO>(`/${taxpayerId}/links?taxYear=${taxYear}`),
  });
}

export function useUpsertLink(taxpayerId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (input: UpsertLinkInput) =>
      (await call<{ data: LinkUpsertResultDTO }>(`/${taxpayerId}/links`, { method: 'PUT', body: JSON.stringify(input) })).data,
    onSuccess: invalidate,
  });
}

export function useRemoveLink(taxpayerId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (linkId: string) => call<void>(`/${taxpayerId}/links/${linkId}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

export function useCompanyOptions(q: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'company-options', q],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: () => call<CompanyOptionListDTO>(`/company-options${qs({ q, limit: 25, offset: 0 })}`),
  });
}

export function useTaxpayerContacts(taxpayerId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'contacts', taxpayerId],
    enabled: !!taxpayerId,
    queryFn: () => call<TaxpayerContactListDTO>(`/${taxpayerId}/contacts`),
  });
}

/** QA D11: contacts of the taxpayer's linked client companies (works from the practice tenant). */
export function useTaxpayerContactCandidates(taxpayerId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'contact-candidates', taxpayerId],
    enabled: !!taxpayerId && enabled,
    queryFn: () => call<TaxpayerContactCandidateListDTO>(`/${taxpayerId}/contact-candidates`),
  });
}

export function useLinkContact(taxpayerId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { portalContactId: string; grantAccess: boolean }) =>
      (await call<{ data: LinkContactResultDTO }>(`/${taxpayerId}/contacts`, { method: 'POST', body: JSON.stringify(v) })).data,
    onSuccess: invalidate,
  });
}

export function useUnlinkContact(taxpayerId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (v: { portalContactId: string; revokeAccess: boolean }) =>
      (await call<{ data: UnlinkContactResultDTO }>(
        `/${taxpayerId}/contacts/${v.portalContactId}?revokeAccess=${v.revokeAccess}`, { method: 'DELETE' })).data,
    onSuccess: invalidate,
  });
}

// ── D17: who can see this taxpayer (staff allow-list) ──

export function useTaxpayerStaff(taxpayerId: string | undefined) {
  return useQuery({
    queryKey: [KEY, 'staff', taxpayerId],
    enabled: !!taxpayerId,
    queryFn: async () => (await call<{ data: TaxpayerStaffDTO }>(`/${taxpayerId}/staff`)).data,
  });
}

/** Firm admins only (the server answers 403 to anyone else); enable it only for them. */
export function useTaxpayerStaffCandidates(taxpayerId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'staff-candidates', taxpayerId],
    enabled: !!taxpayerId && enabled,
    queryFn: () => call<TaxpayerStaffCandidateListDTO>(`/${taxpayerId}/staff-candidates`),
  });
}

export function useReplaceTaxpayerStaff(taxpayerId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (userIds: string[]) =>
      (await call<{ data: TaxpayerStaffDTO }>(`/${taxpayerId}/staff`, { method: 'PUT', body: JSON.stringify({ userIds }) })).data,
    onSuccess: invalidate,
  });
}

export interface TaxEstimatorScopeInfo {
  firmId: string; firmRole: 'firm_admin' | 'firm_staff' | 'firm_readonly'; managedTenantCount: number;
  /** QA D2: firm admin/staff AND the tax_estimator update permission in the active tenant. */
  canWrite?: boolean;
}

/** Who am I acting as (counts only). Drives write controls; the server enforces the role regardless. */
export function useTaxEstimatorScope() {
  return useQuery({
    queryKey: [KEY, 'scope'],
    queryFn: async () => (await apiClient<{ data: TaxEstimatorScopeInfo }>('/tax-estimator/scope', {
      headers: getTaxEstimatorFirmId() ? { 'X-Firm-Id': getTaxEstimatorFirmId()! } : {},
    })).data,
  });
}
