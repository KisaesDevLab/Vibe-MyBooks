// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient, API_BASE } from '../../api/client';
import { useSessionState } from '../../hooks/useSessionState';
import { useClearTagOnCompanyChange } from './useClearTagOnCompanyChange';
import { useLocalState, SHOW_ACCT_NUMBERS_KEY } from '../../hooks/useLocalState';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { ReportShell } from './ReportShell';
import { DateRangePicker } from './DateRangePicker';
import { ReportScopeSelector } from './ReportScopeSelector';
import { ReportTagFilter } from './ReportTagFilter';
import { BasisSelector } from './BasisSelector';
import { ReportAccountMultiSelect } from './ReportAccountMultiSelect';
import { useAccounts } from '../../api/hooks/useAccounts';
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
  // Tag column: the line's own tag ('' = untagged). Optional so an
  // older API response still renders.
  tagLabel?: string;
  runningBalance: number;
}

interface GLAccount {
  id: string;
  accountNumber: string | null;
  name: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'cogs' | 'expense' | 'other_revenue' | 'other_expense';
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
  // Present only when the report was filtered by account_ids.
  accountFilter?: { accounts: Array<{ id: string; accountNumber: string | null; name: string }> };
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
  aje: 'AJE',
  credit_memo: 'CM',
  customer_refund: 'REF',
};

// Full section headers (already plural where natural), in the order the
// backend returns them: Assets, Liabilities, Equity, Revenue, COGS, Expenses,
// then Other Revenue / Other Expenses.
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  cogs: 'Cost of Goods Sold',
  expense: 'Expenses',
  other_revenue: 'Other Revenue',
  other_expense: 'Other Expenses',
};

// Mirrors the API's printed-header note (glAccountFilterNote): a few
// accounts are listed, a long selection collapses to a count.
function accountFilterNote(accounts: Array<{ accountNumber: string | null; name: string }>, showAcctNums: boolean): string {
  if (accounts.length === 0) return 'Accounts: none of the selected accounts were found';
  if (accounts.length > 5) return `Accounts: ${accounts.length} accounts selected`;
  return `Accounts: ${accounts.map((a) => (showAcctNums && a.accountNumber ? `${a.accountNumber} ${a.name}` : a.name)).join(', ')}`;
}

// ─── Main component ──────────────────────────────────────────────

export function GeneralLedgerReport() {
  const today = new Date();
  // Selection criteria persist for the tab session (sessionStorage).
  const [startDate, setStartDate] = useSessionState('vibe:report-gl:startDate', `${today.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useSessionState('vibe:report-gl:endDate', today.toISOString().split('T')[0]!);
  const [scope, setScope] = useSessionState<'company' | 'consolidated'>('vibe:report-gl:scope', 'company');
  const [tagId, setTagId] = useSessionState('vibe:report-gl:tagId', '');
  useClearTagOnCompanyChange(setTagId);
  const [basis, setBasis] = useSessionState<'cash' | 'accrual'>('vibe:report-gl:basis', 'accrual');
  // Account filter (empty = all accounts) — same session persistence as
  // Expenses by Category's multi-select.
  const [accountIds, setAccountIds] = useSessionState<string[]>('vibe:report-gl:accountIds', []);
  const [showAcctNums, setShowAcctNums] = useLocalState(SHOW_ACCT_NUMBERS_KEY, true);
  const { activeCompanyId } = useCompanyContext();

  // Every active account of every type for the filter dropdown.
  const accountsQuery = useAccounts({ limit: 500 });
  const activeAccounts = useMemo(
    () => (accountsQuery.data?.data ?? []).filter((a) => a.isActive !== false),
    [accountsQuery.data],
  );

  // Only query once typed dates are complete and stable.
  const debStartDate = startDate;
  const debEndDate = endDate;

  const params = new URLSearchParams({ start_date: debStartDate, end_date: debEndDate });
  if (scope === 'consolidated') params.set('scope', 'consolidated');
  if (tagId) params.set('tag_id', tagId);
  params.set('basis', basis);
  if (accountIds.length > 0) params.set('account_ids', accountIds.join(','));
  const queryParams = params.toString();

  const { data, isLoading, error } = useQuery<GLReportData>({
    queryKey: ['reports', 'general-ledger', debStartDate, debEndDate, activeCompanyId, scope, tagId, basis, accountIds],
    queryFn: () => apiClient<GLReportData>(`/reports/general-ledger?${queryParams}`),
  });

  return (
    <ReportShell
      title="General Ledger"
      maxWidth="max-w-6xl"
      exportBaseUrl={`${API_BASE}/reports/general-ledger?${queryParams}${!showAcctNums ? '&account_numbers=0' : ''}`}
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
          <ReportAccountMultiSelect
            accounts={activeAccounts}
            selected={accountIds}
            onChange={setAccountIds}
            allLabel="All accounts"
            emptyLabel="No accounts"
            showNumbers={showAcctNums}
            searchable
            groupLabels={ACCOUNT_TYPE_LABELS}
          />
          <BasisSelector value={basis} onChange={setBasis} />
          <ReportScopeSelector scope={scope} onScopeChange={setScope} />
          <ReportTagFilter value={tagId} onChange={setTagId} />
          <label className="flex items-center gap-1.5 text-sm text-gray-600" title="Show account numbers on financial reports">
            <input type="checkbox" checked={showAcctNums} onChange={(e) => setShowAcctNums(e.target.checked)} />
            Account #
          </label>
        </div>
      }
    >
      {isLoading ? (
        <LoadingSpinner className="py-12" />
      ) : error ? (
        <div className="text-center py-12 text-red-600">Failed to load general ledger</div>
      ) : data ? (
        <GeneralLedgerView data={data} showAcctNums={showAcctNums} />
      ) : null}
    </ReportShell>
  );
}

// ─── Body view ───────────────────────────────────────────────────

function GeneralLedgerView({ data, showAcctNums = true }: { data: GLReportData; showAcctNums?: boolean }) {
  const filtered = !!data.accountFilter;
  if (data.accounts.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
        <p className="text-gray-500">
          {filtered ? 'None of the selected accounts were found.' : 'No accounts have activity in the selected period.'}
        </p>
      </div>
    );
  }

  // Group accounts by accountType for visual section breaks. The backend
  // already sorts by type then account number, so we just need to detect
  // type transitions while iterating.
  // A filtered subset needn't balance, so the warning only applies to the
  // full ledger.
  const trialBalanceOk = filtered || Math.abs(data.totalDebits - data.totalCredits) < 0.01;
  const filterNote = filtered ? accountFilterNote(data.accountFilter!.accounts, showAcctNums) : '';

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-800">General Ledger</h2>
        <p className="text-xs text-gray-500 mt-1">
          {data.startDate} to {data.endDate}
          {data.fiscalYearStart && data.fiscalYearStart !== data.startDate && (
            <> &nbsp;·&nbsp; Fiscal year start: {data.fiscalYearStart}</>
          )}
        </p>
        {filterNote && <p className="text-xs text-gray-500 mt-0.5">{filterNote}</p>}
      </div>

      <div className="divide-y divide-gray-200">
        {data.accounts.map((acct, idx) => {
          const prevType = idx > 0 ? data.accounts[idx - 1]!.accountType : null;
          const showTypeBreak = prevType !== acct.accountType;
          return (
            <div key={acct.id}>
              {showTypeBreak && (
                <div className="bg-gray-100 px-6 py-2 text-xs font-bold text-gray-600 uppercase tracking-wide">
                  {ACCOUNT_TYPE_LABELS[acct.accountType] || acct.accountType}
                </div>
              )}
              <AccountSection account={acct} showAcctNums={showAcctNums} />
            </div>
          );
        })}
      </div>

      {/* Report grand totals — sanity check that the books balance */}
      <div className="bg-gray-50 px-6 py-4 border-t-2 border-gray-300">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-700">
            {filtered ? 'Total Activity (selected accounts)' : 'Total Activity (all accounts)'}
          </span>
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

function AccountSection({ account, showAcctNums = true }: { account: GLAccount; showAcctNums?: boolean }) {
  const navigate = useNavigate();

  return (
    <div className="px-6 py-4">
      {/* Account header */}
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-900">
          {showAcctNums && account.accountNumber && (
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
            <th className="text-left py-1.5 font-medium w-[120px]">Tag</th>
            <th className="text-right py-1.5 font-medium w-[110px]">Debit</th>
            <th className="text-right py-1.5 font-medium w-[110px]">Credit</th>
            <th className="text-right py-1.5 font-medium w-[120px]">Balance</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {/* Beginning balance row */}
          <tr className="border-b border-gray-100">
            <td className="py-1.5 italic text-gray-500 font-sans" colSpan={6}>
              Beginning balance
            </td>
            <td className="py-1.5"></td>
            <td className="py-1.5"></td>
            <td className="py-1.5 text-right font-semibold">{fmtMoney(account.beginningBalance)}</td>
          </tr>

          {/* Activity rows */}
          {account.lines.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-2 text-center italic text-gray-400 font-sans">
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
                <td className="py-1 max-w-[120px] break-words font-sans text-gray-700">{line.tagLabel || ''}</td>
                <td className="py-1 text-right">{line.debit > 0 ? fmtMoney(line.debit) : ''}</td>
                <td className="py-1 text-right">{line.credit > 0 ? fmtMoney(line.credit) : ''}</td>
                <td className="py-1 text-right font-semibold">{fmtMoney(line.runningBalance)}</td>
              </tr>
            ))
          )}

          {/* Period totals row */}
          <tr className="border-t-2 border-gray-300 bg-gray-50">
            <td className="py-1.5 font-sans font-semibold text-gray-700" colSpan={6}>
              Total period activity
            </td>
            <td className="py-1.5 text-right font-semibold">{fmtMoney(account.periodDebits)}</td>
            <td className="py-1.5 text-right font-semibold">{fmtMoney(account.periodCredits)}</td>
            <td className="py-1.5"></td>
          </tr>

          {/* Ending balance row */}
          <tr className="bg-gray-50">
            <td className="py-1.5 italic text-gray-700 font-sans font-semibold" colSpan={6}>
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
