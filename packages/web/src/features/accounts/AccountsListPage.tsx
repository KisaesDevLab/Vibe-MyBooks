import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AccountType } from '@kis-books/shared';
import { ACCOUNT_TYPES, formatAccountTypeLabel } from '@kis-books/shared';
import { useAccounts, useDeactivateAccount, useExportAccounts } from '../../api/hooks/useAccounts';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { AccountFormModal } from './AccountFormModal';
import { AccountImportModal } from './AccountImportModal';
import { MergeAccountsModal } from './MergeAccountsModal';
import { Plus, Upload, Download, Merge, Search, Shield, List } from 'lucide-react';
import type { Account } from '@kis-books/shared';

export function AccountsListPage() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<AccountType | ''>('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showMerge, setShowMerge] = useState(false);

  const filters = {
    accountType: typeFilter || undefined,
    isActive: activeFilter,
    search: search || undefined,
    limit: 200,
    offset: 0,
  };

  const { data, isLoading, isError, refetch } = useAccounts(filters);
  const deactivateAccount = useDeactivateAccount();
  const exportAccounts = useExportAccounts();

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;

  const accounts = data?.data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Chart of Accounts</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          <Button variant="secondary" size="sm" onClick={() => exportAccounts.mutate()}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowMerge(true)}>
            <Merge className="h-4 w-4 mr-1" /> Merge
          </Button>
          <Button size="sm" onClick={() => { setEditAccount(null); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New Account
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as AccountType | '')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All Types</option>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>{formatAccountTypeLabel(t)}</option>
          ))}
        </select>
        <select
          value={activeFilter === undefined ? 'all' : activeFilter ? 'active' : 'inactive'}
          onChange={(e) => setActiveFilter(e.target.value === 'all' ? undefined : e.target.value === 'active')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
      </div>

      {/* Table */}
      {accounts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No accounts found. Create your first account or import from CSV.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Detail Type</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {accounts.map((account) => (
                <tr
                  key={account.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => { setEditAccount(account); setShowForm(true); }}
                >
                  <td className="px-6 py-3 text-sm text-gray-500">{account.accountNumber || '—'}</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900 flex items-center gap-2">
                    {account.name}
                    {account.isSystem && <Shield className="h-3.5 w-3.5 text-amber-500" />}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500">{formatAccountTypeLabel(account.accountType)}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{account.detailType?.replace(/_/g, ' ') || '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-900 text-right font-mono">
                    {parseFloat(account.balance).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </td>
                  <td className="px-6 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${account.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {account.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right space-x-2">
                    {['asset', 'liability', 'equity'].includes(account.accountType) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/accounts/${account.id}/register`); }}
                        className="text-xs text-primary-600 hover:text-primary-800"
                      >
                        Register
                      </button>
                    )}
                    {['revenue', 'cogs', 'expense', 'other_revenue', 'other_expense'].includes(account.accountType) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/reports/account-report?account_id=${account.id}`); }}
                        className="text-xs text-primary-600 hover:text-primary-800"
                      >
                        Report
                      </button>
                    )}
                    {!account.isSystem && account.isActive && (
                      <button
                        onClick={(e) => { e.stopPropagation(); deactivateAccount.mutate(account.id); }}
                        className="text-xs text-red-600 hover:text-red-800"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-gray-500 mt-2">{data?.total ?? 0} total accounts</p>

      {/* Modals */}
      {showForm && <AccountFormModal account={editAccount} onClose={() => { setShowForm(false); setEditAccount(null); }} />}
      {showImport && <AccountImportModal onClose={() => setShowImport(false)} />}
      {showMerge && <MergeAccountsModal accounts={accounts} onClose={() => setShowMerge(false)} />}
    </div>
  );
}
