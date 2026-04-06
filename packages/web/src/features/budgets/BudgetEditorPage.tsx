import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useAccounts } from '../../api/hooks/useAccounts';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Plus, Save, Calendar, Copy, Percent, ArrowRight, EyeOff, Eye, Grid3X3, DollarSign, Sparkles } from 'lucide-react';

interface Budget {
  id: string;
  name: string;
  fiscalYear: number;
}

type MonthKey = `month${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}`;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_KEYS: MonthKey[] = Array.from({ length: 12 }, (_, i) => `month${i + 1}` as MonthKey);

function parseAmount(val: string): number {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function BudgetEditorPage() {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [fiscalYear, setFiscalYear] = useState(currentYear);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [lines, setLines] = useState<Record<string, Record<MonthKey, string>>>({});
  const [successMsg, setSuccessMsg] = useState('');
  const [hideZero, setHideZero] = useState(false);
  const [entryMode, setEntryMode] = useState<'annual' | 'monthly'>('annual');
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showPercentModal, setShowPercentModal] = useState(false);
  const [percentValue, setPercentValue] = useState('5');
  const [setupGrowthPct, setSetupGrowthPct] = useState('5');
  const [newBudgetId, setNewBudgetId] = useState<string | null>(null);

  // Fetch all budgets
  const { data: budgetsData, isLoading: budgetsLoading, isError: budgetsError, refetch: refetchBudgets } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => apiClient<{ budgets: Budget[] }>('/budgets'),
  });

  const budgetForYear = useMemo(() => {
    return budgetsData?.budgets?.find((b) => b.fiscalYear === fiscalYear) ?? null;
  }, [budgetsData, fiscalYear]);

  const activeBudgetId = selectedBudgetId ?? budgetForYear?.id ?? null;

  // Fetch budget lines
  const { data: linesData, isLoading: linesLoading, isError: linesError, refetch: refetchLines } = useQuery({
    queryKey: ['budgets', activeBudgetId, 'lines'],
    queryFn: () => apiClient<{ lines: any[] }>(`/budgets/${activeBudgetId}/lines`),
    enabled: !!activeBudgetId,
  });

  // Fetch revenue + expense accounts
  const { data: accountsData, isLoading: accountsLoading } = useAccounts({ isActive: true, limit: 500 });

  const budgetAccounts = useMemo(() => {
    if (!accountsData?.data) return [];
    return accountsData.data.filter(
      (a) => a.accountType === 'revenue' || a.accountType === 'expense',
    );
  }, [accountsData]);

  // Sync fetched lines into local state
  const linesLoaded = linesData?.lines;
  useMemo(() => {
    if (!linesLoaded) return;
    const map: Record<string, Record<MonthKey, string>> = {};
    for (const line of linesLoaded) {
      const row: Record<MonthKey, string> = {} as Record<MonthKey, string>;
      for (const mk of MONTH_KEYS) {
        const snakeKey = mk.replace(/(\d+)/, '_$1');
        row[mk] = (line as any)[snakeKey] ?? (line as any)[mk] ?? '0';
      }
      map[line.account_id ?? line.accountId] = row;
    }
    setLines(map);
  }, [linesLoaded]);

  // ─── Mutations ────────────────────────────────────────────────

  const createBudget = useMutation({
    mutationFn: (input: { name: string; fiscalYear: number }) =>
      apiClient<{ budget: Budget }>('/budgets', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setSelectedBudgetId(data.budget.id);
      setNewBudgetId(data.budget.id);
      setLines({});
      // Show setup modal if prior data exists
      setShowSetupModal(true);
    },
  });

  const saveLines = useMutation({
    mutationFn: (input: { lines: Array<{ accountId: string } & Record<MonthKey, string>> }) =>
      apiClient(`/budgets/${activeBudgetId}/lines`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      setSuccessMsg('Budget saved successfully');
      setTimeout(() => setSuccessMsg(''), 3000);
      queryClient.invalidateQueries({ queryKey: ['budgets', activeBudgetId, 'lines'] });
    },
  });

  const fillFromActuals = useMutation({
    mutationFn: () =>
      apiClient(`/budgets/${activeBudgetId}/fill-from-actuals`, { method: 'POST' }),
    onSuccess: () => {
      refetchLines();
      setSuccessMsg('Filled from prior year actuals');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
  });

  const copyFromBudget = useMutation({
    mutationFn: (sourceId: string) =>
      apiClient(`/budgets/${activeBudgetId}/copy-from/${sourceId}`, { method: 'POST' }),
    onSuccess: () => {
      refetchLines();
      setSuccessMsg('Copied from prior year budget');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
  });

  const adjustByPercent = useMutation({
    mutationFn: (percent: number) =>
      apiClient(`/budgets/${activeBudgetId}/adjust-by-percent`, {
        method: 'POST',
        body: JSON.stringify({ percent }),
      }),
    onSuccess: () => {
      refetchLines();
      setShowPercentModal(false);
      setSuccessMsg('Percentage adjustment applied');
      setTimeout(() => setSuccessMsg(''), 3000);
    },
  });

  // ─── Helpers ──────────────────────────────────────────────────

  const getAnnualTotal = useCallback((accountId: string): number => {
    const row = lines[accountId];
    if (!row) return 0;
    return MONTH_KEYS.reduce((sum, mk) => sum + parseAmount(row[mk]), 0);
  }, [lines]);

  const setAnnualAmount = useCallback((accountId: string, annual: number) => {
    const monthly = (annual / 12).toFixed(2);
    const row: Record<MonthKey, string> = {} as Record<MonthKey, string>;
    for (const mk of MONTH_KEYS) row[mk] = monthly;
    setLines((prev) => ({ ...prev, [accountId]: row }));
  }, []);

  const handleCellChange = useCallback((accountId: string, month: MonthKey, value: string) => {
    setLines((prev) => ({
      ...prev,
      [accountId]: {
        ...(prev[accountId] ?? Object.fromEntries(MONTH_KEYS.map((k) => [k, '0'])) as Record<MonthKey, string>),
        [month]: value,
      },
    }));
  }, []);

  const handleSpreadAnnual = useCallback((accountId: string) => {
    const total = getAnnualTotal(accountId);
    if (total === 0) return;
    setAnnualAmount(accountId, total);
  }, [getAnnualTotal, setAnnualAmount]);

  const handleApplyToAll = useCallback((accountId: string, sourceMonth: MonthKey) => {
    const value = lines[accountId]?.[sourceMonth] ?? '0';
    const row: Record<MonthKey, string> = {} as Record<MonthKey, string>;
    for (const mk of MONTH_KEYS) row[mk] = value;
    setLines((prev) => ({ ...prev, [accountId]: row }));
  }, [lines]);

  const hasNonZero = useCallback((accountId: string): boolean => {
    const row = lines[accountId];
    if (!row) return false;
    return MONTH_KEYS.some((mk) => parseAmount(row[mk]) !== 0);
  }, [lines]);

  const handleSave = () => {
    const lineArray = budgetAccounts.map((acct) => {
      const row = lines[acct.id] ?? Object.fromEntries(MONTH_KEYS.map((k) => [k, '0'])) as Record<MonthKey, string>;
      return { accountId: acct.id, ...row };
    });
    saveLines.mutate({ lines: lineArray });
  };

  const handleCreate = () => {
    createBudget.mutate({ name: `Budget ${fiscalYear}`, fiscalYear });
  };

  // Setup modal handlers
  const handleSetupBlank = () => {
    setShowSetupModal(false);
  };

  const handleSetupCopyPrior = () => {
    const priorBudget = budgetsData?.budgets?.find((b: Budget) => b.fiscalYear === fiscalYear - 1);
    if (priorBudget) {
      copyFromBudget.mutate(priorBudget.id);
    }
    setShowSetupModal(false);
  };

  const handleSetupFromActuals = () => {
    fillFromActuals.mutate();
    setShowSetupModal(false);
  };

  const handleSetupActualsGrowth = async () => {
    setShowSetupModal(false);
    const bid = newBudgetId || activeBudgetId;
    if (!bid) return;
    try {
      await apiClient(`/budgets/${bid}/fill-from-actuals`, { method: 'POST' });
      await apiClient(`/budgets/${bid}/adjust-by-percent`, {
        method: 'POST',
        body: JSON.stringify({ percent: Number(setupGrowthPct) }),
      });
      refetchLines();
      setSuccessMsg(`Filled from actuals with ${setupGrowthPct}% growth`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setSuccessMsg('');
    }
  };

  // Section totals
  const sectionTotal = useCallback((type: 'revenue' | 'expense') => {
    return budgetAccounts
      .filter((a) => a.accountType === type)
      .reduce((sum, a) => sum + getAnnualTotal(a.id), 0);
  }, [budgetAccounts, getAnnualTotal]);

  const priorBudget = budgetsData?.budgets?.find((b: Budget) => b.fiscalYear === fiscalYear - 1);
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  if (budgetsLoading || accountsLoading) return <LoadingSpinner className="py-12" />;
  if (budgetsError) return <ErrorMessage onRetry={() => refetchBudgets()} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Budget Editor</h1>
        <div className="flex items-center gap-2">
          {activeBudgetId && (
            <>
              {/* Entry Mode Toggle */}
              <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden mr-2">
                <button
                  onClick={() => setEntryMode('annual')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                    entryMode === 'annual' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <DollarSign className="h-3.5 w-3.5" /> Annual
                </button>
                <button
                  onClick={() => setEntryMode('monthly')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                    entryMode === 'monthly' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Grid3X3 className="h-3.5 w-3.5" /> Monthly
                </button>
              </div>

              {priorBudget && (
                <Button variant="secondary" onClick={() => copyFromBudget.mutate(priorBudget.id)} loading={copyFromBudget.isPending}>
                  <Copy className="h-4 w-4 mr-1" /> Copy Prior Year
                </Button>
              )}
              <Button variant="secondary" onClick={() => fillFromActuals.mutate()} loading={fillFromActuals.isPending}>
                <Calendar className="h-4 w-4 mr-1" /> Fill from Actuals
              </Button>
              <Button variant="secondary" onClick={() => setShowPercentModal(true)}>
                <Percent className="h-4 w-4 mr-1" /> Adjust %
              </Button>
              <Button variant="secondary" onClick={() => setHideZero(!hideZero)}>
                {hideZero ? <Eye className="h-4 w-4 mr-1" /> : <EyeOff className="h-4 w-4 mr-1" />}
                {hideZero ? 'Show All' : 'Hide Zero'}
              </Button>
              <Button onClick={handleSave} loading={saveLines.isPending}>
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Fiscal Year Selector */}
      <div className="flex items-center gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year</label>
          <select
            value={fiscalYear}
            onChange={(e) => { setFiscalYear(Number(e.target.value)); setSelectedBudgetId(null); }}
            className="block rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {!budgetForYear && (
          <div className="self-end">
            <Button onClick={handleCreate} loading={createBudget.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Create Budget for {fiscalYear}
            </Button>
          </div>
        )}
      </div>

      {/* Quick Setup Modal */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Set Up Your {fiscalYear} Budget</h3>
            <p className="text-sm text-gray-500 mb-5">Choose how to start:</p>
            <div className="space-y-3">
              <button onClick={handleSetupBlank}
                className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:shadow-sm transition-all group">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gray-100 group-hover:bg-primary-50"><Plus className="h-5 w-5 text-gray-500 group-hover:text-primary-600" /></div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Start Blank</p>
                    <p className="text-xs text-gray-500 mt-0.5">Enter all amounts from scratch</p>
                  </div>
                </div>
              </button>

              {priorBudget && (
                <button onClick={handleSetupCopyPrior}
                  className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:shadow-sm transition-all group">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-gray-100 group-hover:bg-primary-50"><Copy className="h-5 w-5 text-gray-500 group-hover:text-primary-600" /></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Copy Last Year's Budget</p>
                      <p className="text-xs text-gray-500 mt-0.5">Start with {fiscalYear - 1} budget amounts</p>
                    </div>
                  </div>
                </button>
              )}

              <button onClick={handleSetupFromActuals}
                className="w-full text-left p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:shadow-sm transition-all group">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gray-100 group-hover:bg-primary-50"><Calendar className="h-5 w-5 text-gray-500 group-hover:text-primary-600" /></div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Use Last Year's Actuals</p>
                    <p className="text-xs text-gray-500 mt-0.5">Pre-fill with what you actually spent/earned in {fiscalYear - 1}</p>
                  </div>
                </div>
              </button>

              <div className="p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:shadow-sm transition-all group">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gray-100 group-hover:bg-primary-50"><Sparkles className="h-5 w-5 text-gray-500 group-hover:text-primary-600" /></div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Actuals + Growth</p>
                    <p className="text-xs text-gray-500 mt-0.5 mb-2">Use {fiscalYear - 1} actuals, adjusted by a percentage</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        value={setupGrowthPct}
                        onChange={(e) => setSetupGrowthPct(e.target.value)}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-right"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-xs text-gray-500">% growth</span>
                      <Button size="sm" onClick={handleSetupActualsGrowth} className="ml-auto">Apply</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowSetupModal(false)} className="text-sm text-gray-500 hover:text-gray-700">
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Percent Adjustment Modal */}
      {showPercentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Adjust All Amounts</h3>
            <p className="text-sm text-gray-600 mb-3">Enter a percentage to increase or decrease all budget amounts.</p>
            <div className="flex items-center gap-2 mb-4">
              <input type="number" step="0.1" value={percentValue} onChange={(e) => setPercentValue(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" autoFocus />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <p className="text-xs text-gray-500 mb-4">Use negative values to decrease (e.g., -10 for a 10% cut).</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowPercentModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">Cancel</button>
              <Button onClick={() => adjustByPercent.mutate(Number(percentValue))} loading={adjustByPercent.isPending}>Apply</Button>
            </div>
          </div>
        </div>
      )}

      {createBudget.error && <p className="text-sm text-red-600 mb-4">{createBudget.error.message}</p>}
      {saveLines.error && <p className="text-sm text-red-600 mb-4">{saveLines.error.message}</p>}
      {successMsg && <p className="text-sm text-green-600 mb-4">{successMsg}</p>}

      {/* Budget Grid */}
      {activeBudgetId ? (
        linesLoading ? <LoadingSpinner className="py-12" /> :
        linesError ? <ErrorMessage onRetry={() => refetchLines()} /> :
        entryMode === 'annual' ? (
          <AnnualView
            budgetAccounts={budgetAccounts}
            lines={lines}
            hideZero={hideZero}
            getAnnualTotal={getAnnualTotal}
            setAnnualAmount={setAnnualAmount}
            hasNonZero={hasNonZero}
            sectionTotal={sectionTotal}
          />
        ) : (
          <MonthlyView
            budgetAccounts={budgetAccounts}
            lines={lines}
            hideZero={hideZero}
            getAnnualTotal={getAnnualTotal}
            setAnnualAmount={setAnnualAmount}
            handleCellChange={handleCellChange}
            handleSpreadAnnual={handleSpreadAnnual}
            handleApplyToAll={handleApplyToAll}
            hasNonZero={hasNonZero}
          />
        )
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No budget exists for {fiscalYear}. Create one to get started.
        </div>
      )}
    </div>
  );
}

// ─── Annual Entry View ────────────────────────────────────────

function AnnualView({ budgetAccounts, lines, hideZero, getAnnualTotal, setAnnualAmount, hasNonZero, sectionTotal }: {
  budgetAccounts: Array<{ id: string; name: string; accountNumber: string | null; accountType: string }>;
  lines: Record<string, Record<MonthKey, string>>;
  hideZero: boolean;
  getAnnualTotal: (id: string) => number;
  setAnnualAmount: (id: string, val: number) => void;
  hasNonZero: (id: string) => boolean;
  sectionTotal: (type: 'revenue' | 'expense') => number;
}) {
  const revenueAccounts = budgetAccounts.filter((a) => a.accountType === 'revenue').filter((a) => !hideZero || hasNonZero(a.id));
  const expenseAccounts = budgetAccounts.filter((a) => a.accountType === 'expense').filter((a) => !hideZero || hasNonZero(a.id));
  const totalRevenue = sectionTotal('revenue');
  const totalExpenses = sectionTotal('expense');

  function AccountRow({ acct }: { acct: { id: string; name: string; accountNumber: string | null } }) {
    const annual = getAnnualTotal(acct.id);
    return (
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-2 text-sm text-gray-900">
          {acct.accountNumber ? `${acct.accountNumber} — ` : ''}{acct.name}
        </td>
        <td className="px-4 py-2 w-48">
          <input
            type="number"
            step="0.01"
            value={annual === 0 ? '' : annual.toFixed(2)}
            onChange={(e) => setAnnualAmount(acct.id, parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className="w-full text-right text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </td>
      </tr>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm max-w-2xl">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
            <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase w-48">Annual Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          <tr className="bg-blue-50">
            <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Revenue</td>
          </tr>
          {revenueAccounts.map((acct) => <AccountRow key={acct.id} acct={acct} />)}
          <tr className="bg-gray-50 font-semibold">
            <td className="px-4 py-2 text-sm">Total Revenue</td>
            <td className="px-4 py-2 text-right font-mono text-sm">${fmt(totalRevenue)}</td>
          </tr>

          <tr className="bg-red-50">
            <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Expenses</td>
          </tr>
          {expenseAccounts.map((acct) => <AccountRow key={acct.id} acct={acct} />)}
          <tr className="bg-gray-50 font-semibold">
            <td className="px-4 py-2 text-sm">Total Expenses</td>
            <td className="px-4 py-2 text-right font-mono text-sm">${fmt(totalExpenses)}</td>
          </tr>

          <tr className="border-t-2 border-gray-300 font-bold">
            <td className="px-4 py-3 text-sm">Net Income</td>
            <td className={`px-4 py-3 text-right font-mono text-sm ${totalRevenue - totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${fmt(totalRevenue - totalExpenses)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Monthly Entry View ───────────────────────────────────────

function MonthlyView({ budgetAccounts, lines, hideZero, getAnnualTotal, setAnnualAmount, handleCellChange, handleSpreadAnnual, handleApplyToAll, hasNonZero }: {
  budgetAccounts: Array<{ id: string; name: string; accountNumber: string | null; accountType: string }>;
  lines: Record<string, Record<MonthKey, string>>;
  hideZero: boolean;
  getAnnualTotal: (id: string) => number;
  setAnnualAmount: (id: string, val: number) => void;
  handleCellChange: (id: string, month: MonthKey, value: string) => void;
  handleSpreadAnnual: (id: string) => void;
  handleApplyToAll: (id: string, month: MonthKey) => void;
  hasNonZero: (id: string) => boolean;
}) {
  function AccountRow({ acct }: { acct: { id: string; name: string; accountNumber: string | null } }) {
    const annual = getAnnualTotal(acct.id);
    return (
      <tr className="hover:bg-gray-50 group">
        <td className="px-4 py-1 text-sm text-gray-900 sticky left-0 bg-white z-10">
          <div className="flex items-center gap-1">
            <span className="flex-1">{acct.accountNumber ? `${acct.accountNumber} — ` : ''}{acct.name}</span>
            <button onClick={() => handleSpreadAnnual(acct.id)} title="Spread annual evenly"
              className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-primary-600">
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </td>
        {MONTH_KEYS.map((mk) => (
          <td key={mk} className="px-1 py-1">
            <input
              type="number" step="0.01"
              value={lines[acct.id]?.[mk] ?? '0'}
              onChange={(e) => handleCellChange(acct.id, mk, e.target.value)}
              onDoubleClick={() => handleApplyToAll(acct.id, mk)}
              title="Double-click to apply to all months"
              className="w-full text-right text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            />
          </td>
        ))}
        <td className="px-1 py-1 bg-gray-50">
          <input
            type="number" step="0.01"
            value={annual === 0 ? '' : annual.toFixed(2)}
            onChange={(e) => setAnnualAmount(acct.id, parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            className="w-full text-right text-sm border border-gray-200 rounded px-2 py-1 font-semibold focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
          />
        </td>
      </tr>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10 min-w-[200px]">Account</th>
            {MONTH_NAMES.map((m) => (
              <th key={m} className="px-2 py-2 text-right text-xs font-medium text-gray-500 uppercase min-w-[100px]">{m}</th>
            ))}
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase min-w-[120px] bg-gray-100">Annual Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          <tr className="bg-blue-50"><td colSpan={14} className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Revenue</td></tr>
          {budgetAccounts.filter((a) => a.accountType === 'revenue').filter((a) => !hideZero || hasNonZero(a.id)).map((acct) => <AccountRow key={acct.id} acct={acct} />)}
          <tr className="bg-red-50"><td colSpan={14} className="px-4 py-2 text-xs font-semibold text-gray-600 uppercase">Expenses</td></tr>
          {budgetAccounts.filter((a) => a.accountType === 'expense').filter((a) => !hideZero || hasNonZero(a.id)).map((acct) => <AccountRow key={acct.id} acct={acct} />)}
        </tbody>
      </table>
    </div>
  );
}
