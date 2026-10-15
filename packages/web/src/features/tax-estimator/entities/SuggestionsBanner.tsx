// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { useState } from 'react';
import type { TreatmentSuggestion } from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { TREATMENT_LABELS } from './labels';

/** A dismissal is remembered for this exact suggestion (a changed suggestion shows again). */
const sigOf = (s: TreatmentSuggestion) => `${s.accountId}:${s.treatment}:${s.pct ?? ''}`;

function readDismissed(key: string | undefined): Set<string> {
  if (!key) return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    const v: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(key: string | undefined, set: Set<string>): void {
  if (!key) return;
  try { window.localStorage.setItem(key, JSON.stringify([...set])); } catch { /* storage unavailable: session-only */ }
}

/**
 * Suggestions are shown for confirmation only; nothing is applied until the user clicks Apply.
 * QA D14: Dismiss is remembered per viewer (browser storage, `storageKey`) across reloads.
 */
export function SuggestionsBanner({ suggestions, canWrite, saving, onApply, storageKey }: {
  suggestions: TreatmentSuggestion[]; canWrite: boolean; saving: boolean; onApply: (s: TreatmentSuggestion[]) => void; storageKey?: string;
}) {
  const [dismissed, setDismissedState] = useState<Set<string>>(() => readDismissed(storageKey));
  const setDismissed = (next: Set<string>) => { setDismissedState(next); writeDismissed(storageKey, next); };
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const visible = suggestions.filter((s) => !dismissed.has(sigOf(s)));
  if (visible.length === 0) return null;
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selected = visible.filter((s) => picked.has(s.accountId));
  return (
    <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2" aria-label="Suggestions">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-semibold text-blue-900">{visible.length} suggested treatment{visible.length === 1 ? '' : 's'} to confirm</h2>
        {canWrite && <Button size="sm" disabled={selected.length === 0 || saving} onClick={() => onApply(selected)}>Apply selected ({selected.length})</Button>}
      </div>
      <p className="text-xs text-blue-800">Suggestions are never applied automatically. Review each one.</p>
      <ul className="divide-y divide-blue-100">
        {visible.map((s) => (
          <li key={s.accountId} className="py-2 flex items-start gap-3 text-sm" data-testid="suggestion-row">
            {canWrite && <input type="checkbox" aria-label={`Select ${s.accountName}`} checked={picked.has(s.accountId)} onChange={() => toggle(s.accountId)} />}
            <div className="flex-1">
              <div className="font-medium text-gray-900">{s.accountNumber ? `${s.accountNumber} ` : ''}{s.accountName}: {TREATMENT_LABELS[s.treatment]}{s.pct ? ` ${s.pct}%` : ''}</div>
              <div className="text-xs text-gray-600">{s.reason}</div>
            </div>
            {canWrite && (
              <div className="flex gap-1">
                <Button size="sm" variant="secondary" disabled={saving} aria-label={`Apply ${s.accountName}`} onClick={() => onApply([s])}>Apply</Button>
                <Button size="sm" variant="ghost" aria-label={`Dismiss ${s.accountName}`} onClick={() => setDismissed(new Set(dismissed).add(sigOf(s)))}>Dismiss</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
