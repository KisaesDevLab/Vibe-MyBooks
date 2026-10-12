// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';

interface Props {
  open: boolean;
  scenarioName: string;
  saving: boolean;
  error?: string;
  onConfirm: (note: string | null) => void;
  onCancel: () => void;
}

/** Finalize = compute fresh and freeze an immutable snapshot (optional note). */
export function FinalizeDialog({ open, scenarioName, saving, error, onConfirm, onCancel }: Props) {
  const [note, setNote] = useState('');
  useEffect(() => { if (open) setNote(''); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div role="dialog" aria-modal="true" aria-label="Finalize estimate" className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Finalize this estimate?</h2>
        <p className="text-sm text-gray-600">
          The &ldquo;{scenarioName}&rdquo; estimate is recomputed from the books now and frozen as a read-only snapshot
          (inputs, results, parameters, warnings and the disclaimer in effect). Later changes never alter it.
        </p>
        <div>
          <label htmlFor="fin-note" className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
          <textarea id="fin-note" rows={3} maxLength={500} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Q4 vouchers sent to client" />
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
          <Button loading={saving} onClick={() => onConfirm(note.trim() === '' ? null : note.trim())}>Finalize</Button>
        </div>
      </div>
    </div>
  );
}
