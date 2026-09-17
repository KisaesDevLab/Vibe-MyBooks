// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Staff hooks for AP Bill Capture (/api/v1/bill-captures). Uploads and the
// document stream use raw fetch (FormData / blob) with the same Bearer +
// X-Company-Id headers apiClient sends; everything else goes through
// apiClient so ApiError codes (BILL_CAPTURE_DUPLICATE, ...) reach callers.

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  BillCaptureDetail,
  BillCaptureListResponse,
  BillCaptureStatus,
  BillCaptureSummary,
  EnterBillCaptureInput,
} from '@kis-books/shared';
import { apiClient, API_BASE, getAccessToken } from '../client';

export const BILL_CAPTURES_KEY = ['bill-captures'] as const;

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const token = getAccessToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  const companyId = localStorage.getItem('activeCompanyId');
  if (companyId) h['X-Company-Id'] = companyId;
  return h;
}

export interface BillCaptureListFilters {
  status?: BillCaptureStatus | '';
  limit?: number;
  offset?: number;
}

export function useBillCaptures(filters: BillCaptureListFilters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.limit) params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));
  const qs = params.toString();
  return useQuery({
    queryKey: [...BILL_CAPTURES_KEY, 'list', filters.status ?? '', filters.limit ?? 50, filters.offset ?? 0],
    queryFn: () => apiClient<BillCaptureListResponse>(`/bill-captures${qs ? `?${qs}` : ''}`),
    // Poll while anything is still being read so rows flip to Ready
    // without a manual refresh.
    refetchInterval: (query) => {
      const rows = query.state.data?.captures ?? [];
      return rows.some((c) => c.status === 'received' || c.status === 'processing') ? 4000 : false;
    },
  });
}

export interface BillCaptureDetailResponse {
  capture: BillCaptureDetail;
  nextReadyId: string | null;
}

export function useBillCapture(id: string | undefined) {
  return useQuery({
    queryKey: [...BILL_CAPTURES_KEY, 'detail', id],
    queryFn: () => apiClient<BillCaptureDetailResponse>(`/bill-captures/${id}`),
    enabled: !!id,
    refetchInterval: (query) => {
      const s = query.state.data?.capture.status;
      return s === 'received' || s === 'processing' ? 3000 : false;
    },
  });
}

export interface UploadedCapture {
  id: string;
  fileName: string;
  status: BillCaptureStatus;
  duplicate: boolean;
}

/** Uploads one batch (up to 20 files) in a single multipart request. */
export function useUploadBillCaptures() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]): Promise<UploadedCapture[]> => {
      const fd = new FormData();
      for (const f of files) fd.append('files', f);
      const res = await fetch(`${API_BASE}/bill-captures`, { method: 'POST', headers: authHeaders(), body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message || `Upload failed (${res.status})`);
      }
      const data = await res.json() as { captures: UploadedCapture[] };
      return data.captures;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: BILL_CAPTURES_KEY }),
  });
}

export interface EnterBillCaptureResult {
  bill: { id: string; txnNumber?: string | null };
  capture: BillCaptureSummary;
  createdVendorId: string | null;
}

export function useEnterBillCapture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EnterBillCaptureInput }) =>
      apiClient<EnterBillCaptureResult>(`/bill-captures/${id}/enter`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BILL_CAPTURES_KEY });
      qc.invalidateQueries({ queryKey: ['bills'] });
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useDiscardBillCapture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient<{ capture: BillCaptureSummary }>(`/bill-captures/${id}/discard`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: BILL_CAPTURES_KEY }),
  });
}

export function useReprocessBillCapture() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient<{ capture: BillCaptureSummary }>(`/bill-captures/${id}/reprocess`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: BILL_CAPTURES_KEY }),
  });
}

/** Object URL for the captured document. A direct <img src> would 401
 *  (no Authorization header on a navigation), so fetch → blob → URL. */
export function useBillCaptureFileUrl(id: string | undefined): { url: string | null; error: string | null } {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) { setUrl(null); return; }
    let objectUrl: string | null = null;
    let cancelled = false;
    setError(null);
    fetch(`${API_BASE}/bill-captures/${id}/file`, { headers: authHeaders() })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not load the document (${res.status})`);
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) { setUrl(null); setError(err instanceof Error ? err.message : 'Could not load the document'); }
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [id]);
  return { url, error };
}
