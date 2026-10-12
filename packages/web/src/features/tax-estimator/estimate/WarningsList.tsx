// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import type { TaxEstimatorWarning } from '@kis-books/shared';

/** All engine / readiness warnings, warnings first. Purely presentational. */
export function WarningsList({ warnings }: { warnings: TaxEstimatorWarning[] }) {
  if (warnings.length === 0) return null;
  const sorted = [...warnings].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'warning' ? -1 : 1));
  return (
    <section aria-label="Warnings" className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
      <h2 className="text-lg font-semibold text-gray-900">Warnings &amp; notes ({warnings.length})</h2>
      <ul className="space-y-1.5">
        {sorted.map((w, i) => (
          <li key={`${w.code}:${i}`} className="flex gap-2 text-sm">
            <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${w.severity === 'warning' ? 'bg-amber-100 text-amber-900' : 'bg-blue-50 text-blue-800'}`}>{w.severity === 'warning' ? 'Warning' : 'Note'}</span>
            <span className="text-gray-800">{w.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
