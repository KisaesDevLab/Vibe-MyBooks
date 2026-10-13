// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Reconciliation detail report — the professional bank-to-books
// reconciliation: summary (statement → adjusted bank balance → balance per
// books → unreconciled difference), cleared-activity roll, supporting
// schedules with aged-item flags, the cleared list, subsequent activity, the
// book-side proof (reconciliation discrepancies) and a sign-off block.
// Reached from the Reconciliation History page and the Reconcile screen via
// /reports/reconciliation-detail?reconciliation_id=<id> — it needs an id,
// so it is deliberately NOT on the reports landing page.

import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient, API_BASE } from '../../api/client';
import { ReportShell } from './ReportShell';
import { ReportTable } from './ReportTable';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import type { ReconProof } from '@kis-books/shared';
import {
  ReconBookProofSection, ReconClearedRollSection, ReconSchedulesSection, ReconSignOffSection,
  ReconSubsequentSection, ReconSummarySection,
} from './reconciliation/ReconProofSections';

interface DetailLine {
  txnDate: string;
  txnType: string;
  txnNumber: string | null;
  description: string | null;
  payment: number | null;
  deposit: number | null;
}

interface DetailResponse {
  title: string;
  reconciliation: {
    id: string;
    accountId: string;
    accountName: string;
    accountNumber: string | null;
    statementDate: string;
    beginningBalance: number;
    statementEndingBalance: number;
    clearedBalance: number | null;
    difference: number | null;
    status: string;
    completedAt: string | null;
    completedBy: string | null;
  };
  statement: {
    id: string;
    periodStart: string | null;
    periodEnd: string;
    attachmentId: string | null;
    fileName: string | null;
    institutionName: string | null;
    maskedAccountNumber: string | null;
  } | null;
  cleared: DetailLine[];
  uncleared: DetailLine[];
  proof: ReconProof;
  totals: {
    clearedPayments: number;
    clearedDeposits: number;
    unclearedPayments: number;
    unclearedDeposits: number;
  };
}

const money = (v: number | null | undefined) => (v == null ? '—' : `$${v.toFixed(2)}`);

const lineColumns = [
  { key: 'txn_date', label: 'Date' },
  { key: 'txn_type', label: 'Type' },
  { key: 'txn_number', label: 'Number' },
  { key: 'description', label: 'Description' },
  { key: 'payment', label: 'Payment', align: 'right' as const, format: 'money' as const },
  { key: 'deposit', label: 'Deposit', align: 'right' as const, format: 'money' as const },
];

const toRow = (l: DetailLine) => ({
  txn_date: l.txnDate,
  txn_type: l.txnType,
  txn_number: l.txnNumber ?? '—',
  description: l.description ?? '—',
  payment: l.payment,
  deposit: l.deposit,
});

export function ReconciliationDetailReport() {
  const [searchParams] = useSearchParams();
  const reconciliationId = searchParams.get('reconciliation_id') ?? '';

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', 'reconciliation-detail', reconciliationId],
    queryFn: () => apiClient<DetailResponse>(`/reports/reconciliation-detail?reconciliation_id=${reconciliationId}`),
    enabled: !!reconciliationId,
  });

  if (!reconciliationId) {
    return (
      <div className="max-w-3xl mx-auto bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
        <p>This report needs a reconciliation to display.</p>
        <Link to="/banking/reconciliation-history" className="text-primary-600 hover:underline text-sm">
          Pick one from the Reconciliation History
        </Link>
      </div>
    );
  }

  const exportBaseUrl = `${API_BASE}/reports/reconciliation-detail?reconciliation_id=${reconciliationId}`;
  const rec = data?.reconciliation;

  return (
    <ReportShell
      title={rec ? `Reconciliation Detail — ${rec.accountName}` : 'Reconciliation Detail'}
      exportBaseUrl={exportBaseUrl}
      maxWidth="max-w-6xl"
    >
      {isLoading ? (
        <LoadingSpinner className="py-12" />
      ) : isError || !data || !rec ? (
        <ErrorMessage message="Couldn't load this reconciliation report." onRetry={refetch} />
      ) : (
        <div className="space-y-6">
          <div className="flex gap-4 text-sm">
            <Link to={`/reports/bank-reconciliation-summary?reconciliation_id=${reconciliationId}`} className="text-primary-600 hover:underline">
              Reconciliation summary
            </Link>
            {rec.status !== 'complete' && (
              <span className="text-amber-700">In progress — figures update as items are cleared.</span>
            )}
          </div>
          {/* Header cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border p-4">
              <p className="text-xs text-gray-500 uppercase">Statement Date</p>
              <p className="text-lg font-medium">{rec.statementDate}</p>
              {data.statement && (
                <p className="text-xs text-gray-500 mt-1">
                  Statement {data.statement.periodStart ? `${data.statement.periodStart} – ` : ''}{data.statement.periodEnd}
                  {data.statement.fileName ? ` · ${data.statement.fileName}` : ''}
                </p>
              )}
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-xs text-gray-500 uppercase">Beginning → Ending</p>
              <p className="text-lg font-mono">{money(rec.beginningBalance)} → {money(rec.statementEndingBalance)}</p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-xs text-gray-500 uppercase">Balance per books / Unreconciled</p>
              <p className="text-lg font-mono">
                {money(data.proof.summary.bookBalance)} /{' '}
                <span className={data.proof.summary.reconciledToBooks ? 'text-green-700' : 'text-red-700'}>
                  {money(data.proof.summary.unreconciledDifference)}
                </span>
              </p>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <p className="text-xs text-gray-500 uppercase">Completed</p>
              <p className="text-sm">
                {rec.completedAt ? new Date(rec.completedAt).toLocaleDateString() : '—'}
                {rec.completedBy ? ` by ${rec.completedBy}` : ''}
              </p>
              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${rec.status === 'complete' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                {rec.status}
              </span>
            </div>
          </div>

          <ReconSummarySection proof={data.proof} />
          <ReconClearedRollSection proof={data.proof} />
          <ReconSchedulesSection proof={data.proof} mode="detail" />

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Cleared Transactions ({data.cleared.length})
              <span className="ml-3 text-sm font-normal text-gray-500 font-mono">
                Payments {money(data.totals.clearedPayments)} · Deposits {money(data.totals.clearedDeposits)}
              </span>
            </h2>
            {data.cleared.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-6 text-sm text-gray-500">No cleared transactions.</div>
            ) : (
              <ReportTable columns={lineColumns} data={data.cleared.map(toRow)} />
            )}
          </div>

          <ReconSubsequentSection proof={data.proof} />
          <ReconBookProofSection proof={data.proof} />
          <ReconSignOffSection proof={data.proof} />
        </div>
      )}
    </ReportShell>
  );
}
