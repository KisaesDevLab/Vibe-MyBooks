import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { ReportShell } from './ReportShell';
import { DateRangePicker } from './DateRangePicker';
import { ReportScopeSelector } from './ReportScopeSelector';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

// ─── Types matching the buildGeneralLedger response shape ────────
interface GLLine {
  lineId: string;
  transactionId: string;
  date: string;
  txnType: string;
  txnNumber: string | null;
  contactName: string | null;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface GLAccount {
  id: string;
  accountNumber: string | null;
  name: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  normalBalance: 'debit' | 'credit';
  beginningBalance: number;
  lines: GLLine[];
  periodDebits: number;
  periodCredits: number;
  endingBalance: number;
}

interface GLReportData {
  title: string;
  startDate: string;
  endDate: string;
  fiscalYearStart: string;
  accounts: GLAccount[];
  totalDebits: number;
  totalCredits: number;
}

// ─── Formatting helpers ──────────────────────────────────────────

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    currencySign: 'accounting',
  });
}

// Friendly labels for transaction type codes
const TXN_TYPE_LABELS: Record<string, string> = {
  invoice: 'INV',
  customer_payment: 'PMT',
  cash_sale: 'SALE',
  expense: 'CHK',
  deposit: 'DEP',
  transfer: 'XFR',
  journal_entry: 'JE',
  credit_memo: 'CM',
  customer_refund: 'REF',
};

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expense',
};

// ─── Main component ──────────────────────────────────────────────

export function GeneralLedgerReport() {
  const today = new Date();
  const [startDate, setStartDate] = useState(`${today.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]!);
  const [scope, setScope] = useState<'company' | 'consolidated'>('company');
  const { activeCompanyId } = useCompanyContext();

  const queryParams = `start_date=${startDate}&end_date=${endDate}${scope === 'consolidated' ? '&scope=consolidated' : ''}`;

  const { data, isLoading, error } = useQuery<GLReportData>({
    queryKey: ['reports', 'general-ledger', startDate, endDate, activeCompanyId, scope],
    queryFn: () => apiClient<GLReportData>(`/reports/general-ledger?${queryParams}`),
  });

  return (
    <ReportShell
      title="General Ledger"
      maxWidth="max-w-6xl"
      exportBaseUrl={`/api/v1/reports/general-ledger?${queryParams}`}
      filters={
        <div className="flex items-center gap-4 flex-wrap">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={(s, e) => {
              setStartDate(s);
              setEndDate(e);
            }}
          />
          <ReportScopeSelector scope={scope} onScopeChange={setScope} />
        </div>
      }
    >
      {isLoading ? (
        <LoadingSpinner className="py-12" />
      ) : error ? (
        <div className="text-center py-12 text-red-600">Failed to load general ledger</div>
      ) : data ? (
        <GeneralLedgerView data={data} />
      ) : null}
    </ReportShell>
  );
}

// ─── Body view ───────────────────────────────────────────────────

function GeneralLedgerView({ data }: { data: GLReportData }) {
  if (data.accounts.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
        <p className="text-gray-500">No accounts have activity in the selected period.</p>
      </div>
    );
  }

  // Group accounts by accountType for visual section breaks. The backend
  // already sorts by type then account number, so we just need to detect
  // type transitions while iterating.
  const trialBalanceOk = Math.abs(data.totalDebits - data.totalCredits) < 0.01;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-800">General Ledger</h2>
        <p className="text-xs text-gray-500 mt-1">
          {data.startDate} to {data.endDate}
          {data.fiscalYearStart && data.fiscalYearStart !== data.startDate && (
            <> &nbsp;·&nbsp; Fiscal year start: {data.fiscalYearStart}</>
          )}
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {data.accounts.map((acct, idx) => {
          const prevType = idx > 0 ? data.accounts[idx - 1]!.accountType : null;
          const showTypeBreak = prevType !== acct.accountType;
          return (
            <div key={acct.id}>
              {showTypeBreak && (
                <div className="bg-gray-100 px-6 py-2 text-xs font-bold text-gray-600 uppercase tracking-wide">
                  {ACCOUNT_TYPE_LABELS[acct.accountType] || acct.accountType}s
                </div>
              )}
              <AccountSection account={acct} />
            </div>
          );
        })}
      </div>

      {/* Report grand totals — sanity check that the books balance */}
      <div className="bg-gray-50 px-6 py-4 border-t-2 border-gray-300">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-700">Total Activity (all accounts)</span>
          <div className="flex gap-8 font-mono">
            <span>
              <span className="text-gray-500 mr-2">Debits:</span>
              <span className="font-semibold">{fmtMoney(data.totalDebits)}</span>
            </span>
            <span>
              <span className="text-gray-500 mr-2">Credits:</span>
              <span className="font-semibold">{fmtMoney(data.totalCredits)}</span>
            </span>
          </div>
        </div>
        {!trialBalanceOk && (
          <div className="mt-2 text-sm text-red-600 font-medium text-right">
            ⚠ Out of balance by {fmtMoney(Math.abs(data.totalDebits - data.totalCredits))}
          </div>
        )}
      </div>
    </div>
  );
}

function AccountSection({ account }: { account: GLAccount }) {
  const navigate = useNavigate();

  return (
    <div className="px-6 py-4">
      {/* Account header */}
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-900">
          {account.accountNumber && (
            <span className="text-gray-500 font-mono mr-2">{account.accountNumber}</span>
          )}
          {account.name}
        </h3>
        <span className="text-xs text-gray-400 uppercase">
          {account.normalBalance === 'debit' ? 'Debit-normal' : 'Credit-normal'}
        </span>
      </div>

      <table className="w-full text-xs">
        <thead className="text-gray-500 uppercase">
          <tr className="border-b border-gray-200">
            <th className="text-left py-1.5 font-medium w-[88px]">Date</th>
            <th className="text-left py-1.5 font-medium w-[50px]">Type</th>
            <th className="text-left py-1.5 font-medium w-[80px]">Ref #</th>
            <th className="text-left py-1.5 font-medium w-[160px]">Name</th>
            <th className="text-left py-1.5 font-medium">Description</th>
            <th className="text-right py-1.5 font-medium w-[110px]">Debit</th>
            <th className="text-right py-1.5 font-medium w-[110px]">Credit</th>
            <th className="text-right py-1.5 font-medium w-[120px]">Balance</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {/* Beginning balance row */}
          <tr className="border-b border-gray-100">
            <td className="py-1.5 italic text-gray-500 font-sans" colSpan={5}>
              Beginning balance
            </td>
            <td className="py-1.5"></td>
            <td className="py-1.5"></td>
            <td className="py-1.5 text-right font-semibold">{fmtMoney(account.beginningBalance)}</td>
          </tr>

          {/* Activity rows */}
          {account.lines.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-2 text-center italic text-gray-400 font-sans">
                No activity in period
              </td>
            </tr>
          ) : (
            account.lines.map((line) => (
              <tr
                key={line.lineId}
                className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer"
                onClick={() => navigate(`/transactions/${line.transactionId}`)}
                title="Click to open transaction"
              >
                <td className="py-1 font-sans text-gray-700">{line.date}</td>
                <td className="py-1 text-gray-500">{TXN_TYPE_LABELS[line.txnType] || line.txnType.toUpperCase()}</td>
                <td className="py-1 text-gray-500">{line.txnNumber || ''}</td>
                <td className="py-1 truncate max-w-[160px] font-sans text-gray-700">{line.contactName || ''}</td>
                <td className="py-1 truncate max-w-[260px] font-sans text-gray-600">{line.description}</td>
                <td className="py-1 text-right">{line.debit > 0 ? fmtMoney(line.debit) : ''}</td>
                <td className="py-1 text-right">{line.credit > 0 ? fmtMoney(line.credit) : ''}</td>
                <td className="py-1 text-right font-semibold">{fmtMoney(line.runningBalance)}</td>
              </tr>
            ))
          )}

          {/* Period totals row */}
          <tr className="border-t-2 border-gray-300 bg-gray-50">
            <td className="py-1.5 font-sans font-semibold text-gray-700" colSpan={5}>
              Total period activity
            </td>
            <td className="py-1.5 text-right font-semibold">{fmtMoney(account.periodDebits)}</td>
            <td className="py-1.5 text-right font-semibold">{fmtMoney(account.periodCredits)}</td>
            <td className="py-1.5"></td>
          </tr>

          {/* Ending balance row */}
          <tr className="bg-gray-50">
            <td className="py-1.5 italic text-gray-700 font-sans font-semibold" colSpan={5}>
              Ending balance
            </td>
            <td className="py-1.5"></td>
            <td className="py-1.5"></td>
            <td className="py-1.5 text-right font-bold text-gray-900">{fmtMoney(account.endingBalance)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
