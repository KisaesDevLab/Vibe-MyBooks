// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Bank Reconciliation Summary — per bank account: last completed
// reconciliation, latest statement on file, statement coverage gaps,
// uncleared posted lines, plus a stale-outstanding-checks (>90 days)
// sub-list. Dedicated component (two sections) following GenericReport's
// conventions: ReportShell + ReportTable, session-persisted criteria,
// CSV/PDF via the shared export flow.

import { useQuery } from '@tanstack/react-query';
import { apiClient, API_BASE } from '../../api/client';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { ReportShell } from './ReportShell';
import { ReportTable } from './ReportTable';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

interface SummaryAccountRow {
  accountId: string;
  accountNumber: string | null;
  name: string;
  lastReconciledDate: string | null;
  lastReconciledBalance: number | null;
  latestStatementEnd: string | null;
  statementCount: number;
  statementGapCount: number;
  unclearedCount: number;
  oldestUnclearedDate: string | null;
  staleCheckCount: number;
}

interface StaleCheckRow {
  accountId: string;
  accountName: string;
  txnDate: string;
  checkNumber: string | null;
  payee: string | null;
  amount: number;
}

interface SummaryResponse {
  title: string;
  accounts: SummaryAccountRow[];
  staleChecks: StaleCheckRow[];
}

export function BankReconciliationSummaryReport() {
  const { activeCompanyId } = useCompanyContext();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['reports', 'bank-reconciliation-summary', activeCompanyId],
    queryFn: () => apiClient<SummaryResponse>('/reports/bank-reconciliation-summary'),
  });

  const exportBaseUrl = `${API_BASE}/reports/bank-reconciliation-summary`;

  const accountRows = (data?.accounts ?? []).map((a) => ({
    account: a.accountNumber ? `${a.accountNumber} · ${a.name}` : a.name,
    last_reconciled: a.lastReconciledDate ?? '—',
    reconciled_balance: a.lastReconciledBalance,
    latest_statement: a.latestStatementEnd ?? '—',
    gap_months: a.statementGapCount,
    uncleared_items: a.unclearedCount,
    oldest_uncleared: a.oldestUnclearedDate ?? '—',
    stale_checks: a.staleCheckCount,
  }));

  const staleRows = (data?.staleChecks ?? []).map((c) => ({
    account: c.accountName,
    txn_date: c.txnDate,
    check_number: c.checkNumber ?? '—',
    payee: c.payee ?? '—',
    amount: c.amount,
  }));

  return (
    <ReportShell title="Bank Reconciliation Summary" exportBaseUrl={exportBaseUrl} maxWidth="max-w-6xl">
      {isLoading ? (
        <LoadingSpinner className="py-12" />
      ) : isError ? (
        <ErrorMessage onRetry={refetch} />
      ) : !data || data.accounts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No active bank accounts found.
        </div>
      ) : (
        <div className="space-y-6">
          <ReportTable
            columns={[
              { key: 'account', label: 'Account' },
              { key: 'last_reconciled', label: 'Last Reconciled' },
              { key: 'reconciled_balance', label: 'Reconciled Balance', align: 'right', format: 'money' },
              { key: 'latest_statement', label: 'Latest Statement' },
              { key: 'gap_months', label: 'Missing Months', align: 'right' },
              { key: 'uncleared_items', label: 'Uncleared Items', align: 'right' },
              { key: 'oldest_uncleared', label: 'Oldest Uncleared' },
              { key: 'stale_checks', label: 'Stale Checks', align: 'right' },
            ]}
            data={accountRows}
          />

          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Stale Outstanding Checks (older than 90 days)</h2>
            {staleRows.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-6 text-sm text-gray-500">
                No uncleared checks older than 90 days.
              </div>
            ) : (
              <ReportTable
                columns={[
                  { key: 'account', label: 'Account' },
                  { key: 'txn_date', label: 'Date' },
                  { key: 'check_number', label: 'Check #' },
                  { key: 'payee', label: 'Payee' },
                  { key: 'amount', label: 'Amount', align: 'right', format: 'money' },
                ]}
                data={staleRows}
              />
            )}
          </div>
        </div>
      )}
    </ReportShell>
  );
}
