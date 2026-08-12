// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Check signature library + step-up re-auth hooks. Uploads are multipart
// (FormData) so they go through a raw fetch with auth headers instead of
// the JSON-only apiClient; signature previews are fetched authenticated
// and exposed as object URLs (the API never serves signature bytes from
// a static path).

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CheckSignature, MySignature, StepUpMethod } from '@kis-books/shared';
import { apiClient, API_BASE } from '../client';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('accessToken');
  const activeCompanyId = localStorage.getItem('activeCompanyId');
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(activeCompanyId ? { 'X-Company-Id': activeCompanyId } : {}),
  };
}

async function uploadSignature(path: string, method: string, image: File, fields: Record<string, string>): Promise<Record<string, unknown>> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  fd.append('image', image);
  const res = await fetch(`${API_BASE}${path}`, { method, body: fd, headers: authHeaders(), credentials: 'include' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error?.message || 'Upload failed');
  return body;
}

export function useSignatures(enabled: boolean) {
  return useQuery({
    queryKey: ['check-signatures'],
    queryFn: () => apiClient<{ signatures: CheckSignature[] }>('/check-signatures'),
    enabled,
  });
}

export function useMySignatures() {
  return useQuery({
    queryKey: ['check-signatures', 'mine'],
    queryFn: () => apiClient<{ signatures: MySignature[] }>('/check-signatures/mine'),
  });
}

function useInvalidateSignatures() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['check-signatures'] });
}

export function useCreateSignature() {
  const invalidate = useInvalidateSignatures();
  return useMutation({
    mutationFn: ({ image, label, maxAmount }: { image: File; label: string; maxAmount?: string }) =>
      uploadSignature('/check-signatures', 'POST', image, { label, ...(maxAmount ? { maxAmount } : {}) }),
    onSuccess: invalidate,
  });
}

export function useReplaceSignatureImage() {
  const invalidate = useInvalidateSignatures();
  return useMutation({
    mutationFn: ({ id, image }: { id: string; image: File }) =>
      uploadSignature(`/check-signatures/${id}/image`, 'PUT', image, {}),
    onSuccess: invalidate,
  });
}

export function useUpdateSignature() {
  const invalidate = useInvalidateSignatures();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; label?: string; maxAmount?: string | null }) =>
      apiClient(`/check-signatures/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: invalidate,
  });
}

export function useSetSignatureUsers() {
  const invalidate = useInvalidateSignatures();
  return useMutation({
    mutationFn: ({ id, userIds }: { id: string; userIds: string[] }) =>
      apiClient(`/check-signatures/${id}/users`, { method: 'PUT', body: JSON.stringify({ userIds }) }),
    onSuccess: invalidate,
  });
}

export function useDeleteSignature() {
  const invalidate = useInvalidateSignatures();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/check-signatures/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

/** Authenticated signature preview as an object URL (revoked on unmount). */
export function useSignatureImage(id: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id) { setUrl(null); return; }
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/check-signatures/${id}/image`, { headers: authHeaders(), credentials: 'include' });
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch { /* preview is best-effort */ }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);
  return url;
}

export function useStepUpMethod(enabled: boolean) {
  return useQuery({
    queryKey: ['check-signatures', 'step-up-method'],
    queryFn: () => apiClient<{ method: StepUpMethod }>('/check-signatures/step-up/method'),
    enabled,
  });
}

export function useStepUp() {
  return useMutation({
    mutationFn: (input: { password?: string; totpCode?: string }) =>
      apiClient<{ stepUpToken: string; expiresAt: string }>('/check-signatures/step-up', {
        method: 'POST', body: JSON.stringify(input),
      }),
  });
}
