// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Shared TB workpaper plumbing: wire types, queries, per-user prefs,
// and the BroadcastChannel fast path (ADR-TB-06 layer 1).

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useSessionState } from '../../hooks/useSessionState';

export interface TbUnitSplit {
  unitId: string;
  unadjusted: number;
  aje: number;
  adjusted: number;
  taxRje: number;
  tax: number;
}

export interface TbWorkpaperRow {
  accountId: string;
  accountNumber: string | null;
  name: string;
  accountType: string;
  detailType: string | null;
  isVirtualRe: boolean;
  unadjusted: number;
  aje: number;
  adjusted: number;
  taxRje: number;
  tax: number;
  units: TbUnitSplit[];
}

export interface TbWorkpaper {
  companyId: string;
  periodEnd: string;
  fyStart: string;
  taxYear: number;
  basis: 'accrual' | 'cash';
  glVersionStamp: number;
  rows: TbWorkpaperRow[];
  totals: Record<string, number>;
}

export interface TbAssignment {
  id: string;
  accountId: string;
  activityUnitId: string | null;
  seedCode: string | null;
  seedActivityType: string | null;
  firmCodeId: string | null;
  source: string;
  aiConfidence: number | null;
}

export interface TbAvailableCodes {
  returnForm: string;
  activityType: string;
  seedCodes: Array<{ code: string; description: string; activityType: string; sortOrder: number; isM1Adjustment: boolean }>;
  firmCodes: Array<{ id: string; code: string; description: string; activityType: string; sortOrder: number; isM1Adjustment: boolean }>;
}

export interface TbDiagnostic {
  kind: string;
  severity: 'error' | 'warning';
  accountId?: string;
  accountName?: string;
  message: string;
}

export function useWorkpaper(periodEnd: string, basis: 'accrual' | 'cash', enabled = true) {
  return useQuery({
    queryKey: ['tb', 'workpaper', periodEnd, basis],
    enabled: enabled && !!periodEnd,
    queryFn: () => apiClient<{ workpaper: TbWorkpaper }>(`/tb/workpaper?periodEnd=${periodEnd}&basis=${basis}`),
  });
}

export function useTbAssignmentsQuery() {
  return useQuery({
    queryKey: ['tb', 'assignments'],
    queryFn: () => apiClient<{ assignments: TbAssignment[] }>('/tb/assignments'),
  });
}

export function useAvailableCodes(enabled = true) {
  return useQuery({
    queryKey: ['tb', 'available-codes'],
    enabled,
    retry: false,
    queryFn: () => apiClient<TbAvailableCodes>('/tb/tax-codes/available'),
  });
}

export function useTbDiagnostics(periodEnd: string, basis: 'accrual' | 'cash') {
  return useQuery({
    queryKey: ['tb', 'diagnostics', periodEnd, basis],
    enabled: !!periodEnd,
    queryFn: () => apiClient<{ diagnostics: TbDiagnostic[]; errorCount: number; warningCount: number }>(
      `/tb/diagnostics?periodEnd=${periodEnd}&basis=${basis}`,
    ),
  });
}

// ADR-TB-02 resolution used by grid cells: unit-specific assignment
// first, then account-level.
export function resolveAssignment(assignments: TbAssignment[], accountId: string, unitId: string | null): TbAssignment | null {
  const forAccount = assignments.filter((a) => a.accountId === accountId);
  if (unitId) {
    const unitMatch = forAccount.find((a) => a.activityUnitId === unitId);
    if (unitMatch) return unitMatch;
  }
  return forAccount.find((a) => a.activityUnitId === null) ?? null;
}

// One shared, session-persisted tax-year override for the whole TB
// module: pick a year on any TB screen and every other TB screen (and
// an in-tab refresh) stays on it. null = follow the profile's current
// tax year.
export function useTbYearOverride() {
  return useSessionState<number | null>('vibe:tb:taxYear', null);
}

// Fiscal-year start (ISO) for a tax-year label.
export function fiscalYearStartFor(taxYear: number, fyStartMonth: number): string {
  if (fyStartMonth <= 1) return `${taxYear}-01-01`;
  return `${taxYear - 1}-${String(fyStartMonth).padStart(2, '0')}-01`;
}

// Fiscal-year end (ISO) for a tax-year label — mirror of the server's
// fiscalYearEnd in tax-profile.service (rule TB10).
export function fiscalYearEndFor(taxYear: number, fyStartMonth: number): string {
  if (fyStartMonth <= 1) return `${taxYear}-12-31`;
  const endMonth = fyStartMonth - 1;
  const lastDay = new Date(Date.UTC(taxYear, endMonth, 0)).getUTCDate();
  return `${taxYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export const usd = (n: number) =>
  Math.abs(n) < 0.005 ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── BroadcastChannel fast path (6B.1/6B.3) ─────────────────────────

export const tbChannelName = (companyId: string) => `tb:${companyId}`;

export type TbChannelMessage =
  | { type: 'changed' }
  | { type: 'focus-account'; accountId: string; column: 'unadjusted' | 'aje'; fyStart?: string; periodEnd?: string };

export function publishTbChange(companyId: string | null | undefined) {
  if (!companyId || typeof BroadcastChannel === 'undefined') return;
  try {
    const ch = new BroadcastChannel(tbChannelName(companyId));
    ch.postMessage({ type: 'changed' } satisfies TbChannelMessage);
    ch.close();
  } catch {
    // BroadcastChannel unavailable (older browser/incognito quirk) —
    // the SSE/poll layers still refresh the popout.
  }
}

export function activeCompanyId(): string | null {
  try {
    return localStorage.getItem('activeCompanyId');
  } catch {
    return null;
  }
}

// Named popout window (6B.1): re-open focuses the existing one.
export function openTbPopout(companyId: string | null) {
  const name = `tb-popout-${companyId ?? 'default'}`;
  const url = `${import.meta.env.BASE_URL}tb/popout`;
  const win = window.open(url, name, 'width=1400,height=900,noopener=no');
  win?.focus();
}
