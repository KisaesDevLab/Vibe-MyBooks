// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Reconcile screen: the bank-to-books summary (Section A of the professional
// reconciliation) shown live while clearing — balance per statement, items
// in transit / outstanding, adjusted bank balance, balance per books,
// adjusted book balance, unreconciled difference — plus a warning banner when
// the book-side proof doesn't tie, with the discrepancy detail on demand.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { reconMoney, reconSummaryLines, type ReconProof } from '@kis-books/shared';
import { ReconBookProofSection, ReconStatementTable } from '../reports/reconciliation/ReconProofSections';

export function ReconProofPanel({ proof, reconId }: { proof: ReconProof; reconId: string }) {
  const [showDetails, setShowDetails] = useState(false);
  const s = proof.summary;
  const b = proof.bookProof;
  const fc = proof.flagCounts;
  const aged = fc.stale + fc.staleDated + fc.investigate;
  return (
    <div className="mb-4 space-y-3" data-testid="recon-proof-panel">
      {!b.ties && (
        <div className="bg-red-50 border border-red-300 rounded-lg p-4" role="alert" data-testid="recon-proof-warning">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800 flex-1">
              <p className="font-semibold">
                The books don&apos;t tie to the reconciled activity — discrepancy {reconMoney(b.discrepancy)}.
              </p>
              {b.explanations[0] && <p className="mt-1">{b.explanations[0]}</p>}
              <button
                type="button"
                className="mt-1 text-red-700 underline font-medium"
                onClick={() => setShowDetails((v) => !v)}
              >
                {showDetails ? 'Hide discrepancy details' : 'Show discrepancy details'}
              </button>
            </div>
          </div>
          {showDetails && <div className="mt-3"><ReconBookProofSection proof={proof} /></div>}
        </div>
      )}

      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
          <h2 className="text-base font-semibold text-gray-900">Bank-to-books reconciliation</h2>
          <Link to={`/reports/reconciliation-detail?reconciliation_id=${reconId}`} className="text-sm text-primary-600 hover:underline">
            Full reconciliation report
          </Link>
        </div>
        {proof.orientation === 'liability' && (
          <p className="text-xs text-gray-500 mb-2">Credit card / liability account: balances are shown as amounts owed.</p>
        )}
        <ReconStatementTable lines={reconSummaryLines(proof)} testId="recon-panel-lines" />
        <div className="mt-2 flex items-center gap-2 text-sm" data-testid="recon-panel-verdict">
          {s.reconciledToBooks ? (
            <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
              <CheckCircle2 className="h-4 w-4" /> Reconciled to books
            </span>
          ) : (
            <span className="text-red-700 font-semibold">
              Unreconciled difference {reconMoney(s.unreconciledDifference)}
              {s.explanations[0] ? ` — ${s.explanations[0]}` : ''}
            </span>
          )}
        </div>
        {aged > 0 && (
          <p className="mt-1 text-xs text-amber-700">
            Aged items on this reconciliation:{' '}
            {[
              fc.staleDated ? `${fc.staleDated} stale-dated (over 180 days)` : '',
              fc.stale ? `${fc.stale} stale (over 90 days)` : '',
              fc.investigate ? `${fc.investigate} to investigate` : '',
            ].filter(Boolean).join(' · ')} — flagged in the list below.
          </p>
        )}
      </div>
    </div>
  );
}
