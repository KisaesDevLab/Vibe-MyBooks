import { useNavigate } from 'react-router-dom';
import { BarChart3, DollarSign, Users, Landmark, Receipt, BookOpen, Wallet } from 'lucide-react';

const reportGroups = [
  {
    title: 'Financial Statements',
    icon: BarChart3,
    reports: [
      { label: 'Profit and Loss', path: '/reports/profit-loss' },
      { label: 'Balance Sheet', path: '/reports/balance-sheet' },
      { label: 'Cash Flow Statement', path: '/reports/cash-flow' },
    ],
  },
  {
    title: 'Receivables',
    icon: DollarSign,
    reports: [
      { label: 'AR Aging Summary', path: '/reports/ar-aging-summary' },
      { label: 'AR Aging Detail', path: '/reports/ar-aging-detail' },
      { label: 'Customer Balance Summary', path: '/reports/customer-balance-summary' },
      { label: 'Customer Balance Detail', path: '/reports/customer-balance-detail' },
      { label: 'Invoice List', path: '/reports/invoice-list' },
    ],
  },
  {
    title: 'Expenses',
    icon: Receipt,
    reports: [
      { label: 'Expenses by Vendor', path: '/reports/expense-by-vendor' },
      { label: 'Expenses by Category', path: '/reports/expense-by-category' },
      { label: 'Vendor Balance Summary', path: '/reports/vendor-balance-summary' },
      { label: 'Transactions by Vendor', path: '/reports/transaction-list-by-vendor' },
    ],
  },
  {
    title: 'Banking',
    icon: Landmark,
    reports: [
      { label: 'Bank Reconciliation', path: '/reports/bank-reconciliation-summary' },
      { label: 'Deposit Detail', path: '/reports/deposit-detail' },
      { label: 'Check Register', path: '/reports/check-register' },
    ],
  },
  {
    title: 'Tax',
    icon: Receipt,
    reports: [
      { label: 'Sales Tax Liability', path: '/reports/sales-tax-liability' },
      { label: 'Taxable Sales Summary', path: '/reports/taxable-sales-summary' },
      { label: 'Sales Tax Payments', path: '/reports/sales-tax-payments' },
      { label: '1099 Vendor Summary', path: '/reports/vendor-1099-summary' },
    ],
  },
  {
    title: 'Budgets',
    icon: Wallet,
    reports: [
      { label: 'Budget vs Actual', path: '/reports/budget-vs-actual' },
      { label: 'Budget Overview', path: '/reports/budget-overview' },
    ],
  },
  {
    title: 'General',
    icon: BookOpen,
    reports: [
      { label: 'General Ledger', path: '/reports/general-ledger' },
      { label: 'Trial Balance', path: '/reports/trial-balance' },
      { label: 'Transaction List', path: '/reports/transaction-list' },
      { label: 'Journal Entry Report', path: '/reports/journal-entry-report' },
    ],
  },
];

export function ReportsPage() {
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Reports</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportGroups.map((group) => (
          <div key={group.title} className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <group.icon className="h-5 w-5 text-primary-600" />
              <h2 className="font-semibold text-gray-800">{group.title}</h2>
            </div>
            <div className="space-y-1">
              {group.reports.map((report) => (
                <button key={report.path} onClick={() => navigate(report.path)}
                  className="block w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-primary-600 rounded-lg transition-colors">
                  {report.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
