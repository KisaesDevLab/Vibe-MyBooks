// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Loader2 } from 'lucide-react';

interface Props {
  bankFeedItemId: string;
}

// Per-row "attach receipt" affordance for bucket rows that don't
// have an attached receipt yet. POSTs multipart to /api/v1/
// attachments with attachable_type='bank_feed_items' so the
// existing attachments route auto-fires receipt OCR (see
// attachments.routes.ts:208). Once the upload completes we
// invalidate the bucket query so the new attachment + its OCR
// signals (when ready) flow through to the row's
// ReceiptComparisonPanel without a refresh.
//
// Mirrors the upload pattern in features/attachments/
// AttachmentUploader.tsx — fetch directly because the
// shared apiClient is JSON-only.
export function AttachReceiptButton({ bankFeedItemId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('attachableType', 'bank_feed_items');
      formData.append('attachableId', bankFeedItemId);
      const res = await fetch('/api/v1/attachments', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Upload failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['practice', 'classification'] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Upload failed'),
  });

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
        title="Attach a receipt — OCR runs automatically"
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {upload.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Paperclip className="h-3.5 w-3.5" />
        )}
        {upload.isPending ? 'Uploading…' : 'Attach receipt'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          // Reset so re-selecting the same file fires onChange.
          e.target.value = '';
        }}
      />
      {error && (
        <span className="text-[11px] text-rose-700" role="alert">
          {error}
        </span>
      )}
    </>
  );
}
