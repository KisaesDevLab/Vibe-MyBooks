// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { AttachmentPanel } from '../../attachments/AttachmentPanel';

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  /**
   * See AttachFileButton — a posted transaction's files live under its own
   * txn_type, which is what TransactionDetail reads, so anything added here
   * shows up there too.
   */
  attachableType: string;
  attachableId: string;
  /**
   * A second place this row's files may live. Used for a posted suspense
   * transaction whose receipt was attached to the bank line BEFORE it posted:
   * nothing relinks those, so showing only the transaction's own files would
   * make the receipt look lost.
   */
  secondary?: { label: string; attachableType: string; attachableId: string } | null;
  onClose: () => void;
}

/**
 * View, add and remove a row's receipts without leaving the Uncategorized
 * screen. Wraps the existing AttachmentPanel wholesale rather than
 * re-implementing upload/list/delete, so this stays a layout concern.
 */
export function RowAttachmentsModal({ open, title, subtitle, attachableType, attachableId, secondary, onClose }: Props) {
  const qc = useQueryClient();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // The row carries a server-computed attachment count, so refresh the list
  // on the way out rather than on every upload/delete inside the panel.
  const close = () => {
    qc.invalidateQueries({ queryKey: ['uncategorized'] });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={`Attachments for ${title}`}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          <AttachmentPanel attachableType={attachableType} attachableId={attachableId} compact />
          {secondary && (
            <div className="border-t border-gray-200 pt-4">
              <p className="mb-2 text-xs text-gray-500">{secondary.label}</p>
              <AttachmentPanel
                attachableType={secondary.attachableType}
                attachableId={secondary.attachableId}
                compact
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
