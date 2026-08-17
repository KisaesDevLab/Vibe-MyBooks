// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { apiClient } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Landmark, FileText, ArrowRight, Wallet, Receipt, Banknote, MessageSquare, Inbox, CalendarClock, CreditCard, PenLine, PiggyBank, ArrowLeftRight, Printer, FilePlus, HandCoins } from 'lucide-react';
import type { ResourceKey, PermissionAction } from '@kis-books/shared';
import { usePermissions } from '../../api/hooks/usePermissions';
import { DashboardAiFooter } from '../../components/ui/DashboardAiFooter';
import { OnboardingBanner } from './OnboardingBanner';
import { useMe } from '../../api/hooks/useAuth';
import { usePracticeVisibility } from '../../hooks/usePracticeVisibility';
import { useLocalState } from '../../hooks/useLocalState';

// Revenue-vs-Expenses period options. Values are what we persist;
// 'ytd' resolves to "months elapsed this calendar year" at render time
// so the choice stays correct across a year boundary.
type TrendPeriod = '3' | '6' | '12' | '24' | 'ytd';
const TREND_PERIODS: Array<{ value: TrendPeriod; label: string }> = [
  { value: '3', label: 'Last 3 Months' },
  { value: '6', label: 'Last 6 Months' },
  { value: '12', label: 'Last 12 Months' },
  { value: '24', label: 'Last 24 Months' },
  { value: 'ytd', label: 'Year to Date' },
];
function trendPeriodMonths(p: TrendPeriod): number {
  return p === 'ytd' ? new Date().getMonth() + 1 : parseInt(p, 10);
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function BudgetProgressBar({ label, actual, budget, type }: { label: string; actual: number; budget: number; type: 'revenue' | 'expense' }) {
  const pct = budget === 0 ? 0 : Math.min((actual / budget) * 100, 150);
  const variance = actual - budget;
  // Revenue: actual > budget = favorable. Expense: actual < budget = favorable.
  const favorable = type === 'revenue' ? variance >= 0 : variance <= 0;
  const pctDiff = budget === 0 ? 0 : Math.abs((variance / budget) * 100);
  const barColor = pctDiff <= 10 ? 'bg-green-500' : (favorable ? 'bg-green-500' : 'bg-red-500');
  const statusColor = pctDiff <= 10 ? 'text-green-600' : (favorable ? 'text-green-600' : 'text-red-600');

  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className={statusColor}>{fmt(actual)} / {fmt(budget)}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string; value: string; subtitle?: string; icon: React.ElementType; color: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );
}

// One bank / credit-card line in the Cash Position panel. When the API
// supplied the account id the whole row is a link to that account's
// register; older API builds (no id) render the same row as plain text.
function CashRow({ id, name, icon: Icon, iconClass, amount, amountClass, onOpen }: {
  id?: string; name: string; icon: React.ElementType; iconClass: string;
  amount: string; amountClass: string; onOpen: (id: string) => void;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={`h-4 w-4 shrink-0 ${iconClass}`} />
        <span className="text-sm text-gray-700 truncate">{name}</span>
      </div>
      <span className={`text-sm font-mono ${amountClass}`}>{amount}</span>
    </>
  );
  if (!id) return <div className="flex justify-between items-center">{inner}</div>;
  return (
    <button
      type="button"
      onClick={() => onOpen(id)}
      title={`Open ${name} register`}
      aria-label={`Open ${name} register`}
      className="flex justify-between items-center w-full text-left -mx-2 px-2 py-1 rounded-md hover:bg-gray-50 group"
    >
      {inner}
    </button>
  );
}

// Dashboard shortcuts — one tap to the everyday entry screens. Each
// carries the same permission resource its sidebar entry uses, so a
// restricted bookkeeper never sees a card that would bounce off a
// RequirePermission guard (can() fails open when the map is absent).
interface QuickAction {
  label: string;
  to: string;
  icon: React.ElementType;
  color: string; // icon tile bg
  resource: ResourceKey;
  action?: PermissionAction;
}
const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Enter Expense', to: '/transactions/new/expense', icon: Receipt, color: 'bg-orange-100 text-orange-700', resource: 'transactions', action: 'create' },
  { label: 'Write Check', to: '/checks/write', icon: PenLine, color: 'bg-purple-100 text-purple-700', resource: 'checks', action: 'create' },
  { label: 'Enter Deposit', to: '/transactions/new/deposit', icon: PiggyBank, color: 'bg-green-100 text-green-700', resource: 'transactions', action: 'create' },
  { label: 'Transfer Funds', to: '/transactions/new/transfer', icon: ArrowLeftRight, color: 'bg-sky-100 text-sky-700', resource: 'transactions', action: 'create' },
  { label: 'Enter Bill', to: '/bills/new', icon: FilePlus, color: 'bg-amber-100 text-amber-700', resource: 'bills', action: 'create' },
  { label: 'Pay Bills', to: '/pay-bills', icon: Banknote, color: 'bg-red-100 text-red-700', resource: 'pay_bills' },
  { label: 'Print Checks', to: '/checks/print', icon: Printer, color: 'bg-slate-100 text-slate-700', resource: 'checks' },
  { label: 'Bank Feed', to: '/banking/feed', icon: Inbox, color: 'bg-blue-100 text-blue-700', resource: 'banking' },
  { label: 'Create Invoice', to: '/invoices/new', icon: FileText, color: 'bg-indigo-100 text-indigo-700', resource: 'invoices', action: 'create' },
  { label: 'Receive Payment', to: '/receive-payment', icon: HandCoins, color: 'bg-emerald-100 text-emerald-700', resource: 'receive_payment', action: 'create' },
];

interface BudgetPeriodPerf { revenueActual: number; revenueBudget: number; expenseActual: number; expenseBudget: number; netActual: number; netBudget: number }
interface BudgetPerf { budgetName: string; budgetId: string; mtd: BudgetPeriodPerf; ytd: BudgetPeriodPerf }
interface DashboardSummary {
  snapshot: { mtd: { revenue: number; expenses: number; netIncome: number }; ytd: { revenue: number; expenses: number; netIncome: number } } | null;
  trend: { data: Array<{ month: string; revenue: number; expenses: number }> } | null;
  cashPosition: { bankAccounts: Array<{ id?: string; name: string; balance: number }>; creditCards: Array<{ id?: string; name: string; balance: number }>; totalBank: number; totalCC: number } | null;
  receivables: { totalOutstanding: number; overdueCount: number; overdueAmount: number; invoiceCount: number } | null;
  payables: {
    totalOwed: number; billCount: number;
    overdueCount: number; overdueAmount: number;
    dueThisWeekCount: number; dueThisWeekAmount: number;
    creditCount: number; creditAmount: number;
    apBalance: number;
  } | null;
  actionItems: { pendingFeedCount: number; overdueInvoiceCount: number; staleReconciliations: Array<{ accountName: string; lastReconciled: string | null }>; pendingDepositCount: number; pendingDepositAmount: number; printQueueCount: number; printQueueAmount: number } | null;
  budgetPerformance: BudgetPerf | null;
  bankingHealth: { totalConnections: number; needsAttention: number; needsAttentionItems: Array<{ id: string; institutionName: string; itemStatus: string; errorMessage: string | null }>; pendingFeedItems: number } | null;
  portalActivity: { questionsAwaitingReply: number; receiptsToReview: number; docRequestsOverdue: number } | null;
  errors: string[];
}

export function DashboardPage() {
  const navigate = useNavigate();

  // /me tells us how many users have access — one of the onboarding
  // banner's completion signals. useMe() is cached app-wide so this
  // doesn't add a request; it's the same query the sidebar / app shell
  // already ran before rendering this page.
  const { data: meData } = useMe();

  // Which practice pages this user can actually open (role + feature
  // flags) — the portal-activity banner only links where the click
  // won't bounce off the PracticeLayout guard.
  const practiceNav = usePracticeVisibility();

  // Per-member permissions gate the quick-action cards (see QUICK_ACTIONS).
  const { can } = usePermissions();

  // One consolidated query instead of the nine independent useQuery calls
  // this used to fire on mount. The backend runs the panels in parallel
  // with Promise.allSettled so a single panel's failure still returns the
  // rest as nulls and lists the failing panel in `errors[]`.
  const summaryQ = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => apiClient<DashboardSummary>('/dashboard/summary?months=6'),
  });
  const summary = summaryQ.data;

  // Chart period of view. The consolidated summary always fetches the
  // 6-month default, so switching periods refetches only the dedicated
  // /dashboard/trend endpoint — not all nine panels. Persisted in
  // localStorage as a durable display preference.
  const [trendPeriod, setTrendPeriod] = useLocalState<TrendPeriod>('vibe:dashboard:trendPeriod', '6');
  const trendMonths = trendPeriodMonths(trendPeriod);
  const trendQ = useQuery({
    queryKey: ['dashboard', 'trend', trendMonths],
    queryFn: () => apiClient<{ data: Array<{ month: string; revenue: number; expenses: number }> }>(`/dashboard/trend?months=${trendMonths}`),
    enabled: !!summary && trendMonths !== 6,
  });

  if (summaryQ.isLoading) return <LoadingSpinner className="py-12" />;

  const snapshot = summary?.snapshot ?? null;
  // Default period renders straight from the summary payload (no extra
  // request); any other period uses the dedicated trend query, keeping
  // the previous data visible while the new range loads.
  const trend = trendMonths === 6 ? (summary?.trend ?? null) : (trendQ.data ?? summary?.trend ?? null);
  const cash = summary?.cashPosition ?? null;
  const receivables = summary?.receivables ?? null;
  const payables = summary?.payables ?? null;
  const budgetPerf = summary?.budgetPerformance ?? null;
  const actions = summary?.actionItems ?? null;
  const bankingHealth = summary?.bankingHealth ?? null;
  const portalActivity = summary?.portalActivity ?? null;

  // Server already assembles the list of failed panels. If the whole request
  // blew up (network error, auth expired, etc.) fall back to "all panels
  // failed" so the banner still renders.
  const dashboardErrors: string[] = summaryQ.isError && !summary
    ? ['Dashboard summary']
    : (summary?.errors ?? []);

  const ytd = snapshot?.ytd || { revenue: 0, expenses: 0, netIncome: 0 };
  const mtd = snapshot?.mtd || { revenue: 0, expenses: 0, netIncome: 0 };
  // When the primary snapshot query errors, show placeholder values in the
  // stat cards instead of zeros — otherwise a failed endpoint silently
  // presents "YTD Net Income $0" as real data alongside the error banner.
  const snapshotFailed = !snapshot;
  const displayValue = (v: number) => snapshotFailed ? '—' : fmt(v);

  // Onboarding signals for the "What's next" banner. We reuse existing
  // summary fields (no new API calls) — if the tenant has any bank
  // connections, any invoice in receivables, or more than one accessible
  // user, that item is marked done.
  const hasBanking =
    (bankingHealth?.totalConnections ?? 0) > 0 ||
    (cash?.bankAccounts.length ?? 0) > 0;
  const hasInvoices = (receivables?.invoiceCount ?? 0) > 0;
  // Proxy: the user has access to more than one tenant (they've been
  // invited into a client's books, or they've added a co-owner). Not a
  // perfect signal for "this tenant has multiple users" but accurate
  // enough as a nudge — we don't have a per-tenant user count in the
  // /me payload and adding an extra fetch just for the banner isn't worth it.
  const hasTeam = (meData?.accessibleTenants?.length ?? 0) > 1;

  // Portal-activity banner rows: pair each server count with the
  // practice page that resolves it, and only show rows whose page the
  // current user can open.
  const canOpen = new Set(practiceNav.items.map((i) => i.key));
  const portalRows = [
    {
      key: 'questions',
      show: (portalActivity?.questionsAwaitingReply ?? 0) > 0 && canOpen.has('client-portal'),
      count: portalActivity?.questionsAwaitingReply ?? 0,
      icon: MessageSquare,
      label: (n: number) => `${n} client ${n === 1 ? 'question' : 'questions'} awaiting your reply`,
      to: '/practice/client-portal',
    },
    {
      key: 'receipts',
      show: (portalActivity?.receiptsToReview ?? 0) > 0 && canOpen.has('receipts-inbox'),
      count: portalActivity?.receiptsToReview ?? 0,
      icon: Inbox,
      label: (n: number) => `${n} portal ${n === 1 ? 'upload' : 'uploads'} to review in the receipts inbox`,
      to: '/practice/receipts-inbox',
    },
    {
      key: 'overdue',
      show: (portalActivity?.docRequestsOverdue ?? 0) > 0 && canOpen.has('reminders'),
      count: portalActivity?.docRequestsOverdue ?? 0,
      icon: CalendarClock,
      label: (n: number) => `${n} document ${n === 1 ? 'request' : 'requests'} past due`,
      to: '/practice/reminders',
    },
  ].filter((r) => r.show);

  const quickActions = QUICK_ACTIONS.filter((a) => can(a.resource, a.action));
  const openRegister = (id: string) => navigate(`/accounts/${id}/register`);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Quick actions — shortcut cards to the everyday entry screens.
          Filtered by the user's effective permissions so nothing here
          leads to a "no access" bounce. */}
      {quickActions.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4" data-testid="quick-actions">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {quickActions.map((a) => (
              <button
                key={a.to}
                type="button"
                onClick={() => navigate(a.to)}
                className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 hover:border-primary-300 hover:bg-primary-50 text-left transition-colors"
              >
                <span className={`p-2 rounded-lg shrink-0 ${a.color}`}>
                  <a.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium text-gray-800 leading-tight">{a.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* First-run onboarding banner — points new operators at the three
          most common next steps. Self-hides once every step is complete,
          and user-dismissable via the X button (persisted in localStorage). */}
      <OnboardingBanner
        hasBanking={hasBanking}
        hasInvoices={hasInvoices}
        hasTeam={hasTeam}
      />

      {/* Per-panel error banner — server reports which panels failed inside
          the single /summary response. A retry re-issues the consolidated
          query, so one click re-tries every panel (including the ones that
          succeeded previously — cheap; the backend is already optimized for
          parallel fetch). */}
      {dashboardErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-red-800">
              Couldn't load part of the dashboard
            </p>
            <p className="text-xs text-red-700 mt-1">
              {dashboardErrors.join(', ')}
            </p>
          </div>
          <button
            onClick={() => { void summaryQ.refetch(); }}
            className="text-xs font-medium text-red-900 underline whitespace-nowrap"
          >
            Retry
          </button>
        </div>
      )}

      {/* Banking Health Banner */}
      {bankingHealth && bankingHealth.needsAttention > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm font-medium text-amber-800">
            {bankingHealth.needsAttention} bank connection{bankingHealth.needsAttention > 1 ? 's' : ''} need{bankingHealth.needsAttention === 1 ? 's' : ''} attention
          </p>
          {bankingHealth.needsAttentionItems.map((item) => (
            <p key={item.id} className="text-xs text-amber-700 mt-1">
              {item.institutionName} — {item.errorMessage || item.itemStatus.replace(/_/g, ' ')}
            </p>
          ))}
          <a href="/banking" className="text-xs font-medium text-amber-900 underline mt-2 inline-block">Fix now</a>
        </div>
      )}

      {/* Bank feed notification — unprocessed (pending) feed transactions
          waiting for review, linking straight to the Bank Feed view. */}
      {(actions?.pendingFeedCount || 0) > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><Inbox className="h-4 w-4 text-blue-700" /></div>
            <div>
              <p className="text-sm font-medium text-blue-900">
                {actions!.pendingFeedCount} unprocessed bank transaction{actions!.pendingFeedCount === 1 ? '' : 's'} in the bank feed
              </p>
              <p className="text-xs text-blue-700 mt-0.5">Review, categorize, or match them to keep your books current.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/banking/feed')}
            className="text-xs font-medium text-blue-900 underline whitespace-nowrap"
          >
            Open bank feed
          </button>
        </div>
      )}

      {/* Client-portal activity — unread questions, unprocessed reminder
          responses, and overdue document requests, each linking to the
          page where it gets handled. */}
      {portalRows.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <p className="text-sm font-medium text-indigo-900 mb-2">Client portal activity</p>
          <div className="space-y-1">
            {portalRows.map((r) => (
              <button
                key={r.key}
                onClick={() => navigate(r.to)}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md hover:bg-indigo-100 text-sm text-indigo-900"
              >
                <r.icon className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>{r.label(r.count)}</span>
                <ArrowRight className="h-3.5 w-3.5 ml-auto text-indigo-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Financial Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Net Income (YTD)" value={displayValue(ytd.netIncome)}
          subtitle={snapshotFailed ? undefined : `MTD: ${fmt(mtd.netIncome)}`}
          icon={ytd.netIncome >= 0 ? TrendingUp : TrendingDown}
          color={ytd.netIncome >= 0 ? 'bg-green-500' : 'bg-red-500'} />
        <StatCard title="Revenue (YTD)" value={displayValue(ytd.revenue)}
          subtitle={snapshotFailed ? undefined : `MTD: ${fmt(mtd.revenue)}`}
          icon={TrendingUp} color="bg-blue-500" />
        <StatCard title="Expenses (YTD)" value={displayValue(ytd.expenses)}
          subtitle={snapshotFailed ? undefined : `MTD: ${fmt(mtd.expenses)}`}
          icon={TrendingDown} color="bg-orange-500" />
        <StatCard title="Cash Position" value={!cash ? '—' : fmt(cash.totalBank || 0)}
          subtitle={cash?.totalCC ? `CC: ${fmt(cash.totalCC)}` : undefined}
          icon={DollarSign} color="bg-primary-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue vs Expense Chart */}
        {/* flex-col so the chart area stretches to whatever height the
            grid row takes — a long Cash Position list no longer leaves a
            blank band under the chart. */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Revenue vs Expenses</h2>
            <select
              value={trendPeriod}
              onChange={(e) => setTrendPeriod(e.target.value as TrendPeriod)}
              className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700 bg-white"
              aria-label="Chart period"
            >
              {TREND_PERIODS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          {/* Chart wrapper: flex-1 (0 basis) + min-height fills the
              remaining card height, never below 280px; ResponsiveContainer
              measures it. */}
          {trend?.data && trend.data.length > 0 ? (
            <div className="flex-1 min-h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend.data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 min-h-[256px] flex items-center justify-center text-gray-400 text-sm">
              No transaction data yet. Create some transactions to see the chart.
            </div>
          )}
        </div>

        {/* Cash Position */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Cash Position</h2>
          {cash?.bankAccounts.length ? (
            <div className="space-y-3">
              {cash.bankAccounts.map((a, i) => (
                <CashRow key={a.id ?? i} id={a.id} name={a.name} icon={Landmark} iconClass="text-blue-500"
                  amount={fmt(a.balance)} amountClass="font-medium" onOpen={openRegister} />
              ))}
              {cash.creditCards.length > 0 && (
                <>
                  <hr />
                  {cash.creditCards.map((a, i) => (
                    <CashRow key={a.id ?? i} id={a.id} name={a.name} icon={CreditCard} iconClass="text-red-400"
                      amount={fmt(Math.abs(a.balance))} amountClass="text-red-600" onOpen={openRegister} />
                  ))}
                </>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No bank accounts with balances.</p>
          )}
        </div>
      </div>

      {/* Budget Performance Widget */}
      {budgetPerf && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary-600" />
              <h2 className="text-sm font-semibold text-gray-700">Budget Performance — {budgetPerf.budgetName}</h2>
            </div>
            <button onClick={() => navigate('/reports/budget-vs-actual')} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              Full Report <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* MTD */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Month to Date</h3>
              <BudgetProgressBar label="Revenue" actual={budgetPerf.mtd.revenueActual} budget={budgetPerf.mtd.revenueBudget} type="revenue" />
              <BudgetProgressBar label="Expenses" actual={budgetPerf.mtd.expenseActual} budget={budgetPerf.mtd.expenseBudget} type="expense" />
              <BudgetProgressBar label="Net Income" actual={budgetPerf.mtd.netActual} budget={budgetPerf.mtd.netBudget} type="revenue" />
            </div>
            {/* YTD */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Year to Date</h3>
              <BudgetProgressBar label="Revenue" actual={budgetPerf.ytd.revenueActual} budget={budgetPerf.ytd.revenueBudget} type="revenue" />
              <BudgetProgressBar label="Expenses" actual={budgetPerf.ytd.expenseActual} budget={budgetPerf.ytd.expenseBudget} type="expense" />
              <BudgetProgressBar label="Net Income" actual={budgetPerf.ytd.netActual} budget={budgetPerf.ytd.netBudget} type="revenue" />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Receivables */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Receivables</h2>
            <button onClick={() => navigate('/reports/ar-aging-summary')} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              View Report <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Outstanding</p>
              <p className="text-xl font-bold font-mono">{fmt(receivables?.totalOutstanding || 0)}</p>
              <p className="text-xs text-gray-400">{receivables?.invoiceCount || 0} invoices</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Overdue</p>
              <p className="text-xl font-bold font-mono text-red-600">{fmt(receivables?.overdueAmount || 0)}</p>
              <p className="text-xs text-gray-400">{receivables?.overdueCount || 0} invoices</p>
            </div>
          </div>
        </div>

        {/* Payables */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Payables</h2>
            <button onClick={() => navigate('/reports/ap-aging-summary')} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              View Report <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Total Owed</p>
              <p className="text-xl font-bold font-mono">{fmt(payables?.totalOwed || 0)}</p>
              <p className="text-xs text-gray-400">{payables?.billCount || 0} bills</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Overdue</p>
              <p className="text-xl font-bold font-mono text-red-600">{fmt(payables?.overdueAmount || 0)}</p>
              <p className="text-xs text-gray-400">{payables?.overdueCount || 0} bills</p>
            </div>
          </div>
          {(payables?.creditCount || 0) > 0 && (
            <p className="text-xs text-gray-400 mt-3 pt-3 border-t">
              {payables!.creditCount} vendor credit{payables!.creditCount > 1 ? 's' : ''} available ({fmt(payables!.creditAmount)})
            </p>
          )}
        </div>

        {/* Action Items */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Action Items</h2>
          <div className="space-y-3">
            {(actions?.pendingFeedCount || 0) > 0 && (
              <button onClick={() => navigate('/banking/feed')} className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-gray-50">
                <div className="p-2 bg-yellow-100 rounded-lg"><FileText className="h-4 w-4 text-yellow-600" /></div>
                <div>
                  <p className="text-sm font-medium">{actions!.pendingFeedCount} bank feed items to review</p>
                  <p className="text-xs text-gray-400">Categorize or match transactions</p>
                </div>
              </button>
            )}
            {(actions?.overdueInvoiceCount || 0) > 0 && (
              <button onClick={() => navigate('/invoices')} className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-gray-50">
                <div className="p-2 bg-red-100 rounded-lg"><AlertTriangle className="h-4 w-4 text-red-600" /></div>
                <div>
                  <p className="text-sm font-medium">{actions!.overdueInvoiceCount} overdue invoices</p>
                  <p className="text-xs text-gray-400">Send reminders or follow up</p>
                </div>
              </button>
            )}
            {actions?.staleReconciliations.map((r, i) => (
              <button key={i} onClick={() => navigate('/banking/reconcile')} className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-gray-50">
                <div className="p-2 bg-blue-100 rounded-lg"><Landmark className="h-4 w-4 text-blue-600" /></div>
                <div>
                  <p className="text-sm font-medium">{r.accountName} needs reconciliation</p>
                  <p className="text-xs text-gray-400">
                    {r.lastReconciled ? `Last: ${new Date(r.lastReconciled).toLocaleDateString()}` : 'Never reconciled'}
                  </p>
                </div>
              </button>
            ))}
            {(actions?.pendingDepositCount || 0) > 0 && (
              <button onClick={() => navigate('/banking/deposit')} className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-gray-50">
                <div className="p-2 bg-green-100 rounded-lg"><DollarSign className="h-4 w-4 text-green-600" /></div>
                <div>
                  <p className="text-sm font-medium">{actions!.pendingDepositCount} payments (${fmt(actions!.pendingDepositAmount)}) ready to deposit</p>
                  <p className="text-xs text-gray-400">Group into a bank deposit</p>
                </div>
              </button>
            )}
            {(actions?.printQueueCount || 0) > 0 && (
              <button onClick={() => navigate('/checks/print')} className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-gray-50">
                <div className="p-2 bg-purple-100 rounded-lg"><FileText className="h-4 w-4 text-purple-600" /></div>
                <div>
                  <p className="text-sm font-medium">{actions!.printQueueCount} checks ({fmt(actions!.printQueueAmount)}) ready to print</p>
                  <p className="text-xs text-gray-400">Print queued checks</p>
                </div>
              </button>
            )}
            {(payables?.overdueCount || 0) > 0 && (
              <button onClick={() => navigate('/pay-bills')} className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-gray-50">
                <div className="p-2 bg-red-100 rounded-lg"><Receipt className="h-4 w-4 text-red-600" /></div>
                <div>
                  <p className="text-sm font-medium">{payables!.overdueCount} overdue bill{payables!.overdueCount > 1 ? 's' : ''} ({fmt(payables!.overdueAmount)})</p>
                  <p className="text-xs text-gray-400">Pay bills now</p>
                </div>
              </button>
            )}
            {(payables?.dueThisWeekCount || 0) > 0 && (
              <button onClick={() => navigate('/pay-bills')} className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-gray-50">
                <div className="p-2 bg-orange-100 rounded-lg"><Banknote className="h-4 w-4 text-orange-600" /></div>
                <div>
                  <p className="text-sm font-medium">{payables!.dueThisWeekCount} bill{payables!.dueThisWeekCount > 1 ? 's' : ''} due this week ({fmt(payables!.dueThisWeekAmount)})</p>
                  <p className="text-xs text-gray-400">Schedule payment</p>
                </div>
              </button>
            )}
            {!actions?.pendingFeedCount && !actions?.overdueInvoiceCount && !actions?.staleReconciliations.length && !actions?.pendingDepositCount && !actions?.printQueueCount && !payables?.overdueCount && !payables?.dueThisWeekCount && (
              <p className="text-sm text-gray-400 text-center py-4">All caught up!</p>
            )}
          </div>
        </div>
      </div>
      <DashboardAiFooter />
    </div>
  );
}
