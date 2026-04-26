// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState } from 'react';

interface Props {
  /** The current rule body (conditions + actions). */
  value: { conditions: unknown; actions: unknown };
  /** Editor mode — view shows pretty-printed read-only JSON;
   *  edit lets a power user paste or modify and apply. */
  mode: 'view' | 'edit';
  /** Called when the user clicks "Apply" in edit mode. The
   *  parent decides what to do (typically: parse + replace the
   *  visual builder's state). The value is the raw JSON string
   *  so the parent can validate. */
  onApply?: (raw: string) => void;
  /** Switching back to Visual mode requires valid JSON; this
   *  callback exposes the current validity so the modal can
   *  block the toggle. */
  onValidityChange?: (valid: boolean, error: string | null) => void;
}

// Phase 5a §5.2 — JSON preview / editor side panel. Two modes:
//   - view: read-only pretty-printed JSON
//   - edit: textarea for pasting / typing; "Apply" button
//     hands the raw string back to the parent for parsing
export function JsonPreview({ value, mode, onApply, onValidityChange }: Props) {
  const initial = JSON.stringify(value, null, 2);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === 'view') {
      setDraft(JSON.stringify(value, null, 2));
      setError(null);
      onValidityChange?.(true, null);
    }
  }, [value, mode, onValidityChange]);

  useEffect(() => {
    if (mode !== 'edit') return;
    try {
      JSON.parse(draft);
      setError(null);
      onValidityChange?.(true, null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON';
      setError(msg);
      onValidityChange?.(false, msg);
    }
  }, [draft, mode, onValidityChange]);

  if (mode === 'view') {
    return (
      <pre className="text-xs font-mono bg-gray-900 text-gray-100 p-3 rounded-md overflow-auto h-full">
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        spellCheck={false}
        className="flex-1 text-xs font-mono bg-gray-900 text-gray-100 p-3 rounded-md min-h-[300px]"
      />
      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={() => onApply?.(draft)}
        disabled={!!error}
        className="inline-flex w-fit items-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        Apply JSON
      </button>
    </div>
  );
}
