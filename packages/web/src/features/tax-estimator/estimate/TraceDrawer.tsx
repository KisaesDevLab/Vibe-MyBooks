// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { formatNumbersInText } from '@kis-books/shared';
import { dollars, pct } from './format';
import type { TraceItem } from './traceRows';

interface Props { title: string; rows: TraceItem[]; onClose: () => void }

/** Right-hand drawer listing the engine's trace rows (label, amount, formula, source) for one calculation line. */
export function TraceDrawer({ title, rows, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  // QA D26: focus moves into the drawer and returns to the control that opened it (Esc, Close or backdrop).
  const openerRef = useRef<Element | null>(null);
  useEffect(() => {
    openerRef.current = document.activeElement;
    closeRef.current?.focus();
    return () => {
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={`Trace: ${title}`} className="h-full w-full max-w-md overflow-y-auto bg-white shadow-xl p-4 space-y-3"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-gray-900">Trace &middot; {title}</h2>
          <button ref={closeRef} type="button" aria-label="Close trace" className="rounded p-1 text-gray-500 hover:bg-gray-100" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">No trace rows were recorded for this line.</p>
        ) : (
          <ol className="space-y-3">
            {rows.map((t, i) => (
              <li key={`${t.id}:${i}`} className="rounded-lg border border-gray-200 p-3 space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-gray-900">{formatNumbersInText(t.label)}</span>
                  <span className="text-sm tabular-nums font-semibold text-gray-900">{dollars(t.amount)}</span>
                </div>
                {t.formula && <p className="text-xs text-gray-600 break-words tabular-nums">{formatNumbersInText(t.formula)}</p>}
                <p className="text-xs text-gray-500">
                  Source: {t.source}{t.marginalRate != null && <> &middot; marginal rate {pct(t.marginalRate)}</>}
                </p>
              </li>
            ))}
          </ol>
        )}
      </aside>
    </div>
  );
}
