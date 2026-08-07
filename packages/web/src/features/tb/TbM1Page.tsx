// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Schedule M-1 & M-2 previews (Phase 9): book→tax bridge with account
// drill-down and the unexplained-difference diagnostic; M-2 equity
// rollforward with a per-account role editor and GL tie-out.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, isApiError } from '../../api/client';
import { useTbProfile } from '../../api/hooks/useTb';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toaster';
import clsx from 'clsx';

interface M1Line {
  accountId: string;
  accountNumber: string | null;
  name: string;
  category: string;
  amount: number;
  flagged: boolean;
}

interface M1 {
  bookIncome: number;
  taxIncome: number;
  computedTaxIncome: number;
  reconciles: boolean;
  additions: number;
  subtractions: number;
  lines: M1Line[];
  unexplained: M1Line[];
}

interface M2Account {
  accountId: string;
  accountNumber: string | null;
  name: string;
  role: string;
  beginning: number;
  activity: number;
  ending: number;
}

interface M2 {
  beginning: number;
  bookIncome: number;
  distributions: number;
  contributions: number;
  other: number;
  computedEnding: number;
  glEndingEquity: number;
  unreconciled: number;
  reconciles: boolean;
  accounts: M2Account[];
}

const CATEGORY_LABELS: Record<string, string> = {
  income_on_return_not_books: 'Income on return, not on books (+)',
  expenses_on_books_not_return: 'Expenses on books, not deductible (+)',
  income_on_books_not_return: 'Income on books, not on return (−)',
  deductions_on_return_not_books: 'Deductions on return, not on books (−)',
};

const ROLES = ['retained', 'distributions', 'contributions', 'other'] as const;

const usd = (n: number) => {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `(${abs})` : abs;
};

export function TbM1Page() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: profileData } = useTbProfile();
  const [taxYear, setTaxYear] = useState<number | null>(null);
  const [basis, setBasis] = useState<'accrual' | 'cash'>('accrual');
  const effYear = taxYear ?? profileData?.fiscal.currentTaxYear ?? new Date().getFullYear();

  const { data: m1Data, isLoading: m1Loading } = useQuery({
    queryKey: ['tb', 'm1', effYear, basis],
    queryFn: () => apiClient<{ m1: M1 }>(`/tb/m1?taxYear=${effYear}&basis=${basis}`),
  });
  const { data: m2Data, isLoading: m2Loading } = useQuery({
    queryKey: ['tb', 'm2', effYear, basis],
    queryFn: () => apiClient<{ m2: M2 }>(`/tb/m2?taxYear=${effYear}&basis=${basis}`),
  });
  const { data: rolesData } = useQuery({
    queryKey: ['tb', 'equity-roles'],
    queryFn: () => apiClient<{ roles: Record<string, string> }>('/tb/equity-roles'),
  });

  const saveRole = useMutation({
    mutationFn: (roles: Record<string, string>) =>
      apiClient('/tb/equity-roles', { method: 'PUT', body: JSON.stringify({ roles }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tb', 'equity-roles'] });
      queryClient.invalidateQueries({ queryKey: ['tb', 'm2'] });
    },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'Save failed'),
  });

  const m1 = m1Data?.m1;
  const m2 = m2Data?.m2;

  const drill = (accountId: string) => navigate(`/transactions?accountId=${accountId}`);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Schedule M-1 / M-2 Preview</h1>
          <p className="text-sm text-gray-500">Book-tax reconciliation and equity rollforward, computed live from the workpaper.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <input type="number" value={effYear} aria-label="Tax year"
            onChange={(e) => setTaxYear(Number(e.target.value))}
            className="w-24 rounded-lg border border-gray-300 px-3 py-2" />
          <select value={basis} aria-label="Basis" onChange={(e) => setBasis(e.target.value as 'accrual' | 'cash')}
            className="rounded-lg border border-gray-300 px-2 py-2">
            <option value="accrual">Accrual</option>
            <option value="cash">Cash</option>
          </select>
        </div>
      </div>

      {/* ── M-1 ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-medium text-gray-900 mb-3">Schedule M-1 — book income to tax income</h2>
        {m1Loading && <LoadingSpinner className="py-8" />}
        {m1 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <Tile label="Book income" value={m1.bookIncome} />
              <Tile label="Additions" value={m1.additions} tone="text-green-700" />
              <Tile label="Subtractions" value={-m1.subtractions} tone="text-red-700" />
              <Tile label="Tax income" value={m1.taxIncome} strong />
            </div>
            {!m1.reconciles && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
                Bridge does not reconcile — computed {usd(m1.computedTaxIncome)} vs tax column {usd(m1.taxIncome)}.
              </p>
            )}
            {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((cat) => {
              const lines = m1.lines.filter((l) => l.category === cat);
              if (lines.length === 0) return null;
              return (
                <div key={cat} className="mb-3">
                  <h3 className="text-xs uppercase text-gray-500 font-medium mb-1">{CATEGORY_LABELS[cat]}</h3>
                  <ul>
                    {lines.map((l) => (
                      <li key={l.accountId + cat} className="flex justify-between text-sm py-0.5 border-b border-gray-50">
                        <button className="hover:text-blue-700 hover:underline text-left" onClick={() => drill(l.accountId)}>
                          {l.accountNumber ? `${l.accountNumber} ` : ''}{l.name}
                          {!l.flagged && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700" title="This account's tax code is not flagged as an M-1 adjustment">unflagged</span>}
                        </button>
                        <span className="font-mono tabular-nums">{usd(l.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {m1.lines.length === 0 && <p className="text-sm text-gray-500">No book-tax differences for TY{effYear}.</p>}
            {m1.unexplained.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <p className="font-medium mb-1">Unexplained differences (9.3)</p>
                <p className="text-xs mb-1">These book-tax deltas ride tax codes NOT flagged as M-1 adjustments — reassign the code or confirm the treatment:</p>
                {m1.unexplained.map((l) => (
                  <div key={l.accountId} className="flex justify-between">
                    <span>{l.name}</span><span className="font-mono tabular-nums">{usd(l.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── M-2 ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-medium text-gray-900 mb-3">Schedule M-2 — equity rollforward</h2>
        {m2Loading && <LoadingSpinner className="py-8" />}
        {m2 && (
          <>
            <table className="text-sm mb-4">
              <tbody>
                <RollRow label="Beginning equity" value={m2.beginning} />
                <RollRow label="+ Book income" value={m2.bookIncome} />
                <RollRow label="− Distributions" value={-m2.distributions} />
                <RollRow label="+ Contributions" value={m2.contributions} />
                <RollRow label="± Other equity changes" value={m2.other} />
                <RollRow label="= Computed ending equity" value={m2.computedEnding} strong />
                <RollRow label="GL ending equity (incl. current income)" value={m2.glEndingEquity} />
              </tbody>
            </table>
            {m2.reconciles ? (
              <p className="text-sm text-green-700 mb-4">✓ Rollforward ties to the general ledger.</p>
            ) : (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
                Unreconciled difference of {usd(m2.unreconciled)} — review the equity role mapping below.
              </p>
            )}
            <h3 className="text-xs uppercase text-gray-500 font-medium mb-1">Equity account roles</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
                  <th className="py-1.5 pr-3">Account</th>
                  <th className="py-1.5 pr-3">Role</th>
                  <th className="py-1.5 pr-3 text-right">Beginning</th>
                  <th className="py-1.5 pr-3 text-right">Activity</th>
                  <th className="py-1.5 text-right">Ending</th>
                </tr>
              </thead>
              <tbody>
                {m2.accounts.map((a) => (
                  <tr key={a.accountId} className="border-b border-gray-100">
                    <td className="py-1.5 pr-3">{a.accountNumber ? `${a.accountNumber} ` : ''}{a.name}</td>
                    <td className="py-1.5 pr-3">
                      <select value={rolesData?.roles[a.accountId] ?? a.role} aria-label={`Role for ${a.name}`}
                        onChange={(e) => saveRole.mutate({ ...(rolesData?.roles ?? {}), [a.accountId]: e.target.value })}
                        className="rounded border border-gray-300 px-1.5 py-1 text-xs">
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{usd(a.beginning)}</td>
                    <td className="py-1.5 pr-3 text-right font-mono tabular-nums">{usd(a.activity)}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{usd(a.ending)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, tone, strong }: { label: string; value: number; tone?: string; strong?: boolean }) {
  return (
    <div className={clsx('rounded-lg border border-gray-200 p-3', strong && 'bg-blue-50/50 border-blue-200')}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={clsx('text-lg font-mono tabular-nums', tone, strong && 'font-semibold')}>{usd(value)}</p>
    </div>
  );
}

function RollRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <tr className={clsx(strong && 'font-semibold border-t border-gray-300')}>
      <td className="py-1 pr-8">{label}</td>
      <td className="py-1 text-right font-mono tabular-nums">{usd(value)}</td>
    </tr>
  );
}
