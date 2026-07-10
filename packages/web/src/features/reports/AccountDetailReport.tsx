// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Generic "<Group> by Account" report — the same summary / GL-style detail
// as Expenses by Category, parameterized for Revenues, Assets, Liabilities
// and Equity. Backed by /reports/{endpoint} (buildAccountDetailReport).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import type { Account, AccountType } from '@kis-books/shared';
import { apiClient, API_BASE } from '../../api/client';
import { useSessionState } from '../../hooks/useSessionState';
import { useDebouncedDate } from '../../hooks/useDebouncedValue';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { useAccounts } from '../../api/hooks/useAccounts';
import { ReportShell } from './ReportShell';
import { DateRangePicker } from './DateRangePicker';
import { ReportScopeSelector } from './ReportScopeSelector';
import { ReportTagFilter } from './ReportTagFilter';
import { BasisSelector } from './BasisSelector';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';

export interface AccountDetailConfig {
  title: string;
  endpoint: string;              // e.g. 'revenue-by-category'
  accountTypes: AccountType[];   // filter + multiselect population
  categoryLabel: string;         // summary column header: 'Category' | 'Account'
  grandTotalLabel: string;       // e.g. 'Total Revenues'
  noun: string;                  // e.g. 'revenue' — empty state + filter label
  sessionPrefix: string;         // e.g. 'revcat' — sessionStorage namespace
}

export const REVENUE_BY_CATEGORY: AccountDetailConfig = {
  title: 'Revenues by Category', endpoint: 'revenue-by-category',
  accountTypes: ['revenue', 'other_revenue'], categoryLabel: 'Category',
  grandTotalLabel: 'Total Revenues', noun: 'revenue', sessionPrefix: 'revcat',
};
export const ASSETS_BY_ACCOUNT: AccountDetailConfig = {
  title: 'Assets by Account', endpoint: 'assets-by-account',
  accountTypes: ['asset'], categoryLabel: 'Account',
  grandTotalLabel: 'Total Assets', noun: 'asset', sessionPrefix: 'assets',
};
export const LIABILITIES_BY_ACCOUNT: AccountDetailConfig = {
  title: 'Liabilities by Account', endpoint: 'liabilities-by-account',
  accountTypes: ['liability'], categoryLabel: 'Account',
  grandTotalLabel: 'Total Liabilities', noun: 'liability', sessionPrefix: 'liab',
};
export const EQUITY_BY_ACCOUNT: AccountDetailConfig = {
  title: 'Equity by Account', endpoint: 'equity-by-account',
  accountTypes: ['equity'], categoryLabel: 'Account',
  grandTotalLabel: 'Total Equity', noun: 'equity', sessionPrefix: 'equity',
};

// Named wrappers so each report lazy-loads by name in the router without
// passing a config prop through React.lazy.
export function RevenuesByCategoryReport() { return <AccountDetailReport config={REVENUE_BY_CATEGORY} />; }
export function AssetsByAccountReport() { return <AccountDetailReport config={ASSETS_BY_ACCOUNT} />; }
export function LiabilitiesByAccountReport() { return <AccountDetailReport config={LIABILITIES_BY_ACCOUNT} />; }
export function EquityByAccountReport() { return <AccountDetailReport config={EQUITY_BY_ACCOUNT} />; }

interface SummaryRow {
  account_id: string; category: string; account_number: string | null; account_type: string; total: string;
}
interface DetailLine {
  lineId: string; transactionId: string; date: string; txnType: string; txnNumber: string | null;
  contactName: string | null; memo: string; debit: number; credit: number; balance: number;
}
interface DetailGroup {
  accountId: string; accountNumber: string | null; name: string; accountType: string;
  lines: DetailLine[]; totalDebits: number; totalCredits: number; subtotal: number;
  // Present on carry-forward (balance-sheet) reports.
  beginningBalance?: number; endingBalance?: number;
}
interface ReportData {
  title: string; startDate: string; endDate: string; data: SummaryRow[];
  groups?: DetailGroup[]; grandTotal?: number;
}

function fmtMoney(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', currencySign: 'accounting' });
}

const TXN_TYPE_LABELS: Record<string, string> = {
  invoice: 'INV', customer_payment: 'PMT', cash_sale: 'SALE', expense: 'CHK', deposit: 'DEP',
  transfer: 'XFR', journal_entry: 'JE', credit_memo: 'CM', customer_refund: 'REF', bill: 'BILL',
  bill_payment: 'BP', vendor_credit: 'VC',
};

function AccountMultiSelect({ accounts, selected, onChange, noun }: {
  accounts: Account[]; selected: string[]; onChange: (ids: string[]) => void; noun: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const label = selected.length === 0 ? `All ${noun} accounts` : `${selected.length} selected`;
  return (
    <div className="relative" ref={containerRef}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
        {label}
        <ChevronDown className="h-4 w-4 text-gray-400" />
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 max-h-72 w-72 overflow-auto rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
          {accounts.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-gray-500">No {noun} accounts</p>
          ) : (
            <>
              {selected.length > 0 && (
                <button type="button" onClick={() => onChange([])}
                  className="mb-1 w-full rounded px-2 py-1 text-left text-xs font-medium text-blue-600 hover:bg-blue-50">
                  Clear selection (show all)
                </button>
              )}
              {accounts.map((a) => (
                <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50">
                  <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} className="rounded border-gray-300" />
                  <span className="truncate">{a.accountNumber ? `${a.accountNumber} — ${a.name}` : a.name}</span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function AccountDetailReport({ config }: { config: AccountDetailConfig }) {
  const today = new Date();
  const ns = (k: string) => `vibe:report-${config.sessionPrefix}:${k}`;
  const [startDate, setStartDate] = useSessionState(ns('startDate'), `${today.getFullYear()}-01-01`);
  const [endDate, setEndDate] = useSessionState(ns('endDate'), today.toISOString().split('T')[0]!);
  const [scope, setScope] = useSessionState<'company' | 'consolidated'>(ns('scope'), 'company');
  const [tagId, setTagId] = useSessionState(ns('tagId'), '');
  const [view, setView] = useSessionState<'detail' | 'summary'>(ns('view'), 'detail');
  const [accountIds, setAccountIds] = useSessionState<string[]>(ns('accountIds'), []);
  const [basis, setBasis] = useSessionState<'cash' | 'accrual'>(ns('basis'), 'accrual');
  const { activeCompanyId } = useCompanyContext();

  const debStartDate = useDebouncedDate(startDate);
  const debEndDate = useDebouncedDate(endDate);

  const accountsQuery = useAccounts({ limit: 500 });
  const groupAccounts = useMemo(
    () => (accountsQuery.data?.data ?? []).filter((a) => config.accountTypes.includes(a.accountType)),
    [accountsQuery.data, config.accountTypes],
  );

  const params = new URLSearchParams({ start_date: debStartDate, end_date: debEndDate });
  if (scope === 'consolidated') params.set('scope', 'consolidated');
  if (tagId) params.set('tag_id', tagId);
  if (accountIds.length > 0) params.set('account_ids', accountIds.join(','));
  if (view === 'detail') params.set('display', 'detail');
  params.set('basis', basis);
  const queryParams = params.toString();

  const { data, isLoading, isError, refetch } = useQuery<ReportData>({
    queryKey: ['reports', config.endpoint, debStartDate, debEndDate, activeCompanyId, scope, tagId, accountIds, view, basis],
    queryFn: () => apiClient<ReportData>(`/reports/${config.endpoint}?${queryParams}`),
  });

  return (
    <ReportShell
      title={config.title}
      maxWidth="max-w-6xl"
      exportBaseUrl={`${API_BASE}/reports/${config.endpoint}?${queryParams}`}
      filters={
        <div className="flex flex-wrap items-center gap-4">
          <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
          <AccountMultiSelect accounts={groupAccounts} selected={accountIds} onChange={setAccountIds} noun={config.noun} />
          <label className="flex items-center gap-2 text-sm text-gray-600">
            View
            <select aria-label="Report view mode" value={view} onChange={(e) => setView(e.target.value as 'detail' | 'summary')}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm">
              <option value="detail">Detail</option>
              <option value="summary">Summary</option>
            </select>
          </label>
          <BasisSelector value={basis} onChange={setBasis} />
          <ReportScopeSelector scope={scope} onScopeChange={setScope} />
          <ReportTagFilter value={tagId} onChange={setTagId} />
        </div>
      }
    >
      {isLoading ? (
        <LoadingSpinner className="py-12" />
      ) : isError ? (
        <ErrorMessage onRetry={refetch} />
      ) : data ? (
        view === 'detail' && data.groups ? (
          <DetailView data={data} config={config} />
        ) : (
          <SummaryView data={data} config={config} startDate={debStartDate} endDate={debEndDate} />
        )
      ) : null}
    </ReportShell>
  );
}

function DetailView({ data, config }: { data: ReportData; config: AccountDetailConfig }) {
  const groups = data.groups ?? [];
  if (groups.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
        <p className="text-gray-500">No {config.noun} activity in the selected period.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-base font-semibold text-gray-800">{config.title}</h2>
        <p className="text-xs text-gray-500 mt-1">{data.startDate} to {data.endDate}</p>
      </div>
      <div className="divide-y divide-gray-200">
        {groups.map((group) => <AccountSection key={group.accountId} group={group} />)}
      </div>
      <div className="bg-gray-50 px-6 py-4 border-t-2 border-gray-300">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-700">{config.grandTotalLabel}</span>
          <span className="font-mono font-bold text-gray-900">{fmtMoney(data.grandTotal ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}

function AccountSection({ group }: { group: DetailGroup }) {
  const navigate = useNavigate();
  const label = group.accountNumber ? `${group.accountNumber} — ${group.name}` : group.name;
  return (
    <div className="px-6 py-4">
      <h3 className="text-sm font-bold text-gray-900 mb-2">
        {group.accountNumber && <span className="text-gray-500 font-mono mr-2">{group.accountNumber}</span>}
        {group.name}
      </h3>
      <table className="w-full text-xs">
        <thead className="text-gray-500 uppercase">
          <tr className="border-b border-gray-200">
            <th className="text-left py-1.5 font-medium w-[88px]">Date</th>
            <th className="text-left py-1.5 font-medium w-[50px]">Type</th>
            <th className="text-left py-1.5 font-medium w-[80px]">Number</th>
            <th className="text-left py-1.5 font-medium w-[160px]">Name</th>
            <th className="text-left py-1.5 font-medium">Memo</th>
            <th className="text-right py-1.5 font-medium w-[110px]">Debit</th>
            <th className="text-right py-1.5 font-medium w-[110px]">Credit</th>
            <th className="text-right py-1.5 font-medium w-[120px]">Balance</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {group.beginningBalance !== undefined && (
            <tr className="border-b border-gray-100">
              <td className="py-1 font-sans italic text-gray-500" colSpan={7}>Beginning Balance</td>
              <td className="py-1 text-right font-semibold">{fmtMoney(group.beginningBalance)}</td>
            </tr>
          )}
          {group.lines.length === 0 && group.beginningBalance === undefined ? (
            <tr><td colSpan={8} className="py-2 text-center italic text-gray-400 font-sans">No activity in period</td></tr>
          ) : (
            group.lines.map((line) => (
              <tr key={line.lineId} className="border-b border-gray-50 hover:bg-blue-50 cursor-pointer"
                onClick={() => navigate(`/transactions/${line.transactionId}`)} title="Click to open transaction">
                <td className="py-1 font-sans text-gray-700">{line.date}</td>
                <td className="py-1 text-gray-500">{TXN_TYPE_LABELS[line.txnType] || line.txnType.toUpperCase()}</td>
                <td className="py-1 text-gray-500">{line.txnNumber || ''}</td>
                <td className="py-1 truncate max-w-[160px] font-sans text-gray-700">{line.contactName || ''}</td>
                <td className="py-1 truncate max-w-[260px] font-sans text-gray-600">{line.memo}</td>
                <td className="py-1 text-right">{line.debit > 0 ? fmtMoney(line.debit) : ''}</td>
                <td className="py-1 text-right">{line.credit > 0 ? fmtMoney(line.credit) : ''}</td>
                <td className="py-1 text-right font-semibold">{fmtMoney(line.balance)}</td>
              </tr>
            ))
          )}
          <tr className="border-t-2 border-gray-300 bg-gray-50">
            <td className="py-1.5 font-sans font-semibold text-gray-700" colSpan={5}>
              {group.endingBalance !== undefined ? `Ending Balance ${label}` : `Total ${label}`}
            </td>
            <td className="py-1.5 text-right font-semibold">{fmtMoney(group.totalDebits)}</td>
            <td className="py-1.5 text-right font-semibold">{fmtMoney(group.totalCredits)}</td>
            <td className="py-1.5 text-right font-bold text-gray-900">{fmtMoney(group.endingBalance ?? group.subtotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SummaryView({ data, config, startDate, endDate }: { data: ReportData; config: AccountDetailConfig; startDate: string; endDate: string }) {
  const navigate = useNavigate();
  if (!data.data || data.data.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-12 text-center">
        <p className="text-gray-500">No {config.noun} activity in the selected period.</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
          <tr className="border-b border-gray-200">
            <th className="text-left px-6 py-2.5 font-medium w-[90px]">#</th>
            <th className="text-left px-6 py-2.5 font-medium">{config.categoryLabel}</th>
            <th className="text-right px-6 py-2.5 font-medium w-[160px]">Total</th>
          </tr>
        </thead>
        <tbody>
          {data.data.map((row) => (
            <tr key={row.account_id} className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer"
              onClick={() => navigate(`/transactions?account=${row.account_id}&from=${startDate}&to=${endDate}`)} title="Click to see transactions">
              <td className="px-6 py-2 font-mono text-gray-500">{row.account_number || ''}</td>
              <td className="px-6 py-2 text-gray-800">{row.category}</td>
              <td className="px-6 py-2 text-right font-mono">{fmtMoney(Number(row.total) || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
