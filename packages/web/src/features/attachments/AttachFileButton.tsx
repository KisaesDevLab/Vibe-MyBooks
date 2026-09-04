// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Paperclip, Loader2 } from 'lucide-react';

interface Props {
  /**
   * The polymorphic key. Bank-feed rows use 'bank_feed_items'; a POSTED
   * transaction uses its own txn_type ('expense', 'deposit', ...), which is
   * the convention TransactionDetail follows. Getting this wrong does not
   * error — the file uploads and then appears nowhere.
   */
  attachableType: string;
  attachableId: string;
  /** Query keys to invalidate once the upload lands. */
  invalidateKeys?: string[][];
  label?: string;
  /** Renders icon-only, for a table cell. */
  compact?: boolean;
  /** Badge shown next to the icon when the record already has files. */
  count?: number;
  onUploaded?: () => void;
}

/**
 * One-click "attach a file" for a row, without leaving the page.
 *
 * Uploads multipart to /api/v1/attachments, which auto-fires receipt OCR for
 * images. Posts with `fetch` rather than the shared apiClient because that
 * client is JSON-only.
 *
 * Extracted from close-review's AttachReceiptButton so the Uncategorized
 * screen does not carry a near-copy of the same upload logic.
 */
export function AttachFileButton({
  attachableType, attachableId, invalidateKeys = [], label = 'Attach', compact, count = 0, onUploaded,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('attachableType', attachableType);
      formData.append('attachableId', attachableId);
      const res = await fetch(`${import.meta.env.BASE_URL}api/v1/attachments`, {
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
      setError(null);
      for (const key of invalidateKeys) qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['attachments', attachableType, attachableId] });
      onUploaded?.();
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Upload failed'),
  });

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
        title={count > 0
          ? `${count} file(s) attached — click to add another`
          : 'Attach a receipt or document. Images are read automatically.'}
        aria-label={count > 0 ? `${label} (${count} attached)` : label}
        className={compact
          ? 'inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-1.5 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50'
          : 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50'}
      >
        {upload.isPending
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <Paperclip className={`h-3.5 w-3.5 ${count > 0 ? 'text-primary-600' : ''}`} />}
        {compact
          ? (count > 0 ? <span className="tabular-nums">{count}</span> : null)
          : (upload.isPending ? 'Uploading…' : count > 0 ? `${label} (${count})` : label)}
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
      {error && <span className="text-[11px] text-rose-700" role="alert">{error}</span>}
    </>
  );
}
