// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// R7 in-app Verify (super-admin sign-off). One dialog for "Mark verified" on a row and
// for the bulk "Verify all unverified" action: an explicit confirmation plus an optional
// audited note. Verifying records who / when / note and changes nothing else; a verified
// row can still be overridden with a reason (the override starts unverified).
import { useState, type ReactNode } from 'react';
import { Button } from '../../../components/ui/Button';

export function VerifyDialog({ title, message, value, confirmLabel, saving, serverError, onConfirm, onClose }: {
  title: string;
  message: string;
  /** QA2-06 (R6-04): the value being signed, shown in the dialog itself (single-row verify). */
  value?: ReactNode;
  confirmLabel: string;
  saving: boolean;
  serverError?: string | null;
  onConfirm: (note: string | undefined) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-label={title} className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-700 mt-2">{message}</p>
        {value !== undefined && (
          <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Value you are verifying</div>
            <div data-testid="verify-value" className="mt-1 text-gray-900">{value}</div>
          </div>
        )}
        <label className="block text-sm font-medium text-gray-700 mt-4 mb-1" htmlFor="tp-verify-note">Note (optional, audited)</label>
        <input id="tp-verify-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000}
          placeholder="Source checked, e.g. Rev. Proc. 2025-32 §3.01"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        {serverError && <p role="alert" className="text-xs text-red-600 mt-2">{serverError}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(note.trim() === '' ? undefined : note.trim())} loading={saving}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}

/** "Verified by x@y on Oct 12, 2026" line under a verified row (in-app verification only). */
export function VerifiedLine({ row }: { row: { verifiedAt?: string | null; verifiedByEmail?: string | null; verificationNote?: string | null } }) {
  if (!row.verifiedAt) return null;
  return (
    <div className="text-xs text-green-800" data-testid="verified-line">
      Verified{row.verifiedByEmail ? ` by ${row.verifiedByEmail}` : ''} on {new Date(row.verifiedAt).toLocaleDateString()}
      {row.verificationNote ? ` — ${row.verificationNote}` : ''}
    </div>
  );
}
