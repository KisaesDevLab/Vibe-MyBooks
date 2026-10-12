// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { presentWarningMessage, type BooksReadiness, type TaxEstimatorWarning } from '@kis-books/shared';
import { formatMoney } from '../../../utils/money';

/** QA D16: the readiness and entity lists can carry the same warning; show each once. */
export function uniqueWarnings(list: TaxEstimatorWarning[]): TaxEstimatorWarning[] {
  const seen = new Set<string>();
  return list.filter((w) => { const k = `${w.code}\u0000${w.message}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** Books readiness as warnings, never blocks (MODULE.md 'Books readiness'). */
export function ReadinessPanel({ readiness: r }: { readiness: BooksReadiness }) {
  const warnings = uniqueWarnings([...r.warnings, ...r.entity.warnings]);
  const suspenseNonZero = Number(r.suspense.balance) !== 0 || r.suspense.transactionCount > 0 || r.suspense.unpostedFeedCount > 0;
  return (
    <section className="space-y-2 bg-white rounded-lg border border-gray-200 p-4" aria-label="Books readiness">
      <h2 className="text-lg font-semibold text-gray-900">Books readiness</h2>
      <p className="text-sm text-gray-700" data-testid="last-closed">
        Last closed month: <strong>{r.lastClosedMonth ?? 'none'}</strong>
        {r.throughIsOpen && <span className="text-amber-700"> &mdash; the selected month is still open</span>}
      </p>
      {r.unreconciledAccounts.length > 0 && (
        <div className="text-sm text-amber-800" role="status">
          Unreconciled accounts:
          <ul className="list-disc ml-5">
            {r.unreconciledAccounts.map((a) => (
              <li key={a.accountId}>{a.accountNumber ? `${a.accountNumber} ` : ''}{a.name} (reconciled through {a.closedThroughMonth ?? 'never'})</li>
            ))}
          </ul>
        </div>
      )}
      {suspenseNonZero && (
        <p className="text-sm text-amber-800" role="status">
          Suspense / uncategorized: {formatMoney(r.suspense.balance)} across {r.suspense.transactionCount} transactions
          {r.suspense.unpostedFeedCount > 0 && `, ${r.suspense.unpostedFeedCount} unposted feed items`}.
        </p>
      )}
      {r.unmappedAccounts.length > 0 && (
        <div className="text-sm text-amber-800" role="status">
          Accounts with activity and no mapping (treated as ordinary):
          <ul className="list-disc ml-5">
            {r.unmappedAccounts.map((a) => <li key={a.accountId}>{a.accountNumber ? `${a.accountNumber} ` : ''}{a.name}: {formatMoney(a.bookAmount)}</li>)}
          </ul>
        </div>
      )}
      {warnings.map((w) => (
        <p key={w.code + w.message} className={`text-sm ${w.severity === 'warning' ? 'text-amber-800' : 'text-gray-600'}`} role="status">{presentWarningMessage(w)}</p>
      ))}
      {!r.unreconciledAccounts.length && !suspenseNonZero && !r.unmappedAccounts.length && warnings.length === 0 && (
        <p className="text-sm text-green-700">No readiness issues found.</p>
      )}
    </section>
  );
}
