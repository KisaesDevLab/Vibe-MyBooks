// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toaster';
import { ArrowLeft, Building2, Users, Briefcase, BarChart3, Power, Trash2, AlertTriangle, BookOpen, CalendarRange, UserPlus, Search, X } from 'lucide-react';
import { useCoaTemplateOptions } from '../../api/hooks/useCoaTemplateOptions';

interface TenantUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
}

interface TenantCompany {
  id: string;
  name: string;
  isSetupComplete: boolean;
}

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  users: TenantUser[];
  companies: TenantCompany[];
  stats: {
    accountCount: number;
    nonSystemAccountCount: number;
    contactCount: number;
    transactionCount: number;
  };
}

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();

  // Delete confirmation state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingAccessChange, setPendingAccessChange] = useState<
    { userId: string; email: string; isActive: boolean } | null
  >(null);
  const [showDeleteCoa, setShowDeleteCoa] = useState(false);
  const [coaError, setCoaError] = useState<string | null>(null);
  const [showDeleteTxns, setShowDeleteTxns] = useState(false);
  const [txnConfirmText, setTxnConfirmText] = useState('');
  const [txnError, setTxnError] = useState<string | null>(null);
  // Date-range transaction delete state.
  const [showDeleteRange, setShowDeleteRange] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeConfirmText, setRangeConfirmText] = useState('');
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [templateSlug, setTemplateSlug] = useState('general_business');
  const [coaApplyMsg, setCoaApplyMsg] = useState<string | null>(null);
  const coaTemplateOptions = useCoaTemplateOptions();
  // Company hard-delete (type-to-confirm) + payroll-history purge state.
  const [deleteCompanyId, setDeleteCompanyId] = useState<string | null>(null);
  const [deleteCompanyName, setDeleteCompanyName] = useState('');
  const [companyConfirmText, setCompanyConfirmText] = useState('');
  const [companyDeleteError, setCompanyDeleteError] = useState<string | null>(null);
  const [showDeletePayroll, setShowDeletePayroll] = useState(false);
  const [payrollError, setPayrollError] = useState<string | null>(null);
  const [showAddFirmUser, setShowAddFirmUser] = useState(false);

  const toggleAccessMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient(`/admin/users/${userId}/toggle-tenant-access`, {
        method: 'POST',
        body: JSON.stringify({ tenantId: id }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', id] }),
  });

  // Hard-delete the tenant. The backend rejects the request if any user
  // would be stranded with no other tenant access (see deleteTenant() in
  // admin.service.ts), and the error surfaces in the modal so the
  // operator knows exactly which users to fix first.
  const deleteMutation = useMutation({
    mutationFn: () => apiClient(`/admin/tenants/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] });
      navigate('/admin/tenants');
    },
    onError: (err: Error) => {
      setDeleteError(err.message || 'Delete failed');
    },
  });

  const closeDeleteModal = () => {
    if (deleteMutation.isPending) return;
    setShowDeleteModal(false);
    setDeleteConfirmText('');
    setDeleteError(null);
  };

  // Delete the tenant's chart of accounts — the backend refuses if any
  // transaction exists (COA_HAS_TRANSACTIONS). Used to fix a wrong COA
  // template on a fresh tenant before re-seeding.
  const deleteCoaMutation = useMutation({
    mutationFn: () => apiClient(`/admin/tenants/${id}/chart-of-accounts`, { method: 'DELETE' }),
    onSuccess: () => {
      setShowDeleteCoa(false);
      setCoaError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', id] });
    },
    onError: (err: Error) => setCoaError(err.message || 'Delete failed'),
  });

  // Apply a COA template — only valid on an EMPTY chart of accounts.
  const applyCoaMutation = useMutation({
    mutationFn: () => apiClient<{ accountsCreated: number }>(`/admin/tenants/${id}/apply-coa-template`, {
      method: 'POST',
      body: JSON.stringify({ templateSlug }),
    }),
    onSuccess: (r) => {
      setCoaApplyMsg(`Applied — ${r.accountsCreated} accounts created.`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', id] });
    },
    onError: (err: Error) => setCoaApplyMsg(err.message || 'Apply failed'),
  });

  // Books reset: wipes every transaction (keeps COA/contacts/users/
  // settings, resets bank-feed matches + balances). Type-to-confirm.
  const deleteTxnsMutation = useMutation({
    mutationFn: () => apiClient(`/admin/tenants/${id}/transactions`, { method: 'DELETE' }),
    onSuccess: () => {
      setShowDeleteTxns(false);
      setTxnConfirmText('');
      setTxnError(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', id] });
    },
    onError: (err: Error) => setTxnError(err.message || 'Delete failed'),
  });

  // Hard-delete one company (and all its company-scoped data). The backend
  // refuses to delete a tenant's only company.
  const deleteCompanyMutation = useMutation({
    mutationFn: () => apiClient<{ rowsDeleted?: number }>(`/admin/tenants/${id}/companies/${deleteCompanyId}`, { method: 'DELETE' }),
    onSuccess: (r) => {
      setDeleteCompanyId(null); setCompanyConfirmText(''); setCompanyDeleteError(null);
      toast.success(`Company deleted${r.rowsDeleted != null ? ` — ${r.rowsDeleted.toLocaleString()} rows removed` : ''}.`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', id] });
    },
    onError: (err: Error) => setCompanyDeleteError(err.message || 'Delete failed'),
  });

  // Purge payroll import history (record-only — posted journal entries stay).
  const deletePayrollMutation = useMutation({
    mutationFn: () => apiClient<{ sessionCount?: number }>(`/admin/tenants/${id}/payroll-import-history`, { method: 'DELETE' }),
    onSuccess: (r) => {
      setShowDeletePayroll(false); setPayrollError(null);
      toast.success(`Payroll import history deleted${r.sessionCount != null ? ` — ${r.sessionCount} record(s)` : ''}.`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', id] });
    },
    onError: (err: Error) => setPayrollError(err.message || 'Delete failed'),
  });

  // Preview counts for the date-range delete. Runs only while the modal
  // is open with both dates set, so the operator sees exactly what will
  // be removed before confirming.
  const rangeValid = /^\d{4}-\d{2}-\d{2}$/.test(rangeStart) && /^\d{4}-\d{2}-\d{2}$/.test(rangeEnd) && rangeStart <= rangeEnd;
  const rangePreview = useQuery({
    queryKey: ['admin', 'tenants', id, 'range-count', rangeStart, rangeEnd],
    queryFn: () => apiClient<{ transactionsToDelete: number; feedItemsToDelete: number; reconciliationsToDelete: number }>(
      `/admin/tenants/${id}/transactions-range-count?startDate=${rangeStart}&endDate=${rangeEnd}`,
    ),
    enabled: showDeleteRange && rangeValid,
  });

  // Delete transactions dated in [start, end] — also purges bank-feed
  // items by feed_date and deletes overlapping reconciliations; balances
  // are recomputed server-side.
  const deleteRangeMutation = useMutation({
    mutationFn: () => apiClient<{ transactionsDeleted: number; feedItemsDeleted: number; reconciliationsDeleted: number }>(
      `/admin/tenants/${id}/delete-transactions-range`,
      { method: 'POST', body: JSON.stringify({ startDate: rangeStart, endDate: rangeEnd }) },
    ),
    onSuccess: (r) => {
      setShowDeleteRange(false);
      setRangeConfirmText('');
      setRangeError(null);
      toast.success(
        `Deleted ${r.transactionsDeleted} transaction(s), ${r.feedItemsDeleted} bank feed item(s), and ${r.reconciliationsDeleted} reconciliation(s).`,
      );
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', id] });
    },
    onError: (err: Error) => setRangeError(err.message || 'Delete failed'),
  });

  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ['admin', 'tenants', id],
    queryFn: async () => {
      const res = await apiClient<{
        tenant: { id: string; name: string; slug: string; createdAt?: string; created_at?: string };
        users: TenantUser[];
        companies: Array<{ id: string; businessName?: string; business_name?: string; name?: string; setupComplete?: boolean; setup_complete?: boolean }>;
        stats?: { accounts?: string; non_system_accounts?: string; transactions?: string; contacts?: string };
      }>(`/admin/tenants/${id}`);
      return {
        id: res.tenant.id,
        name: res.tenant.name,
        slug: res.tenant.slug,
        isActive: true,
        createdAt: res.tenant.createdAt || res.tenant.created_at,
        users: res.users,
        companies: (res.companies || []).map((c) => ({
          id: c.id,
          name: c.businessName || c.business_name || c.name,
          isSetupComplete: c.setupComplete ?? c.setup_complete ?? false,
        })),
        stats: {
          accountCount: parseInt(res.stats?.accounts || '0'),
          nonSystemAccountCount: parseInt(res.stats?.non_system_accounts || '0'),
          contactCount: parseInt(res.stats?.contacts || '0'),
          transactionCount: parseInt(res.stats?.transactions || '0'),
        },
      } as TenantDetail;
    },
    enabled: !!id,
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load tenant. {(error as Error)?.message}
          <button
            onClick={() => window.location.reload()}
            className="ml-4 text-sm underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-700">
          Tenant not found.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <ConfirmDialog
        open={!!pendingAccessChange}
        title={`${pendingAccessChange?.isActive ? 'Revoke' : 'Grant'} access?`}
        message={`${pendingAccessChange?.isActive ? 'Revoke' : 'Grant'} access for "${pendingAccessChange?.email}" to this tenant.`}
        confirmLabel={pendingAccessChange?.isActive ? 'Revoke' : 'Grant'}
        variant={pendingAccessChange?.isActive ? 'danger' : 'primary'}
        onCancel={() => setPendingAccessChange(null)}
        onConfirm={() => {
          if (pendingAccessChange) toggleAccessMutation.mutate(pendingAccessChange.userId);
          setPendingAccessChange(null);
        }}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/tenants')}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Building2 className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            tenant.isActive
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {tenant.isActive ? 'Active' : 'Disabled'}
        </span>
      </div>

      {/* Tenant Info Card */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Tenant Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Name:</span>{' '}
            <span className="font-medium text-gray-900">{tenant.name}</span>
          </div>
          <div>
            <span className="text-gray-500">Slug:</span>{' '}
            <span className="font-medium text-gray-900">{tenant.slug}</span>
          </div>
          <div>
            <span className="text-gray-500">Created:</span>{' '}
            <span className="font-medium text-gray-900">
              {new Date(tenant.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100">
            <BarChart3 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Accounts</p>
            <p className="text-xl font-bold text-gray-900">{tenant.stats.accountCount}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100">
            <Users className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Contacts</p>
            <p className="text-xl font-bold text-gray-900">{tenant.stats.contactCount}</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100">
            <Briefcase className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Transactions</p>
            <p className="text-xl font-bold text-gray-900">{tenant.stats.transactionCount}</p>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <Users className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Users ({tenant.users.length})
          </h2>
          <button
            onClick={() => setShowAddFirmUser(true)}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-700 border border-primary-300 hover:bg-primary-50 rounded-lg"
          >
            <UserPlus className="h-4 w-4" /> Add firm user
          </button>
        </div>
        {tenant.users.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Active</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Super Admin</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Last Login</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenant.users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 text-gray-900">{u.email}</td>
                    <td className="px-4 py-3 text-gray-700">{u.displayName || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          u.isActive ? 'bg-green-500' : 'bg-red-400'
                        }`}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {u.isSuperAdmin ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                          Yes
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleString()
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() =>
                          setPendingAccessChange({
                            userId: u.id,
                            email: u.email,
                            isActive: u.isActive,
                          })
                        }
                        className={`text-xs font-medium px-3 py-1 rounded-full ${
                          u.isActive
                            ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700'
                            : 'bg-red-100 text-red-700 hover:bg-green-100 hover:text-green-700'
                        }`}
                        title={u.isActive ? 'Revoke Access' : 'Grant Access'}
                      >
                        {u.isActive ? 'Active' : 'Revoked'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Companies Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Companies ({tenant.companies.length})
          </h2>
        </div>
        {tenant.companies.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No companies found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Setup Complete</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenant.companies.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          c.isSetupComplete
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {c.isSetupComplete ? 'Complete' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setCompanyDeleteError(null); setCompanyConfirmText(''); setDeleteCompanyId(c.id); setDeleteCompanyName(c.name); }}
                        disabled={tenant.companies.length <= 1}
                        title={tenant.companies.length <= 1 ? "A tenant's only company can't be deleted — delete the tenant instead." : 'Permanently delete this company and all its data'}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 border border-red-300 hover:bg-red-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Chart of Accounts — apply a template when the COA is empty
          (fresh tenant, or after Delete chart of accounts below). */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Chart of Accounts</h2>
        </div>
        <div className="p-6 flex items-end justify-between gap-4 flex-wrap">
          <div className="text-sm flex-1 min-w-[260px]">
            <p className="font-medium text-gray-900">Apply a template</p>
            <p className="text-gray-600 mt-1">
              {tenant.stats.nonSystemAccountCount === 0
                ? 'This tenant has no non-system accounts — pick a business-type template to seed its chart of accounts. (System accounts, if any, are kept.)'
                : `This tenant already has ${tenant.stats.nonSystemAccountCount} non-system accounts. To apply a different template, delete the chart of accounts first (Danger Zone below — only possible before any transactions).`}
            </p>
            {coaApplyMsg && (
              <p className={`mt-1 ${coaApplyMsg.startsWith('Applied') ? 'text-green-700' : 'text-red-700'}`}>{coaApplyMsg}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select value={templateSlug} onChange={(e) => setTemplateSlug(e.target.value)}
              disabled={tenant.stats.nonSystemAccountCount > 0}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400 min-w-[220px]">
              {coaTemplateOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button
              onClick={() => { setCoaApplyMsg(null); applyCoaMutation.mutate(); }}
              disabled={tenant.stats.nonSystemAccountCount > 0 || applyCoaMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {applyCoaMutation.isPending ? 'Applying…' : 'Apply template'}
            </button>
          </div>
        </div>
      </div>

      <RetainedEarningsCard tenantId={id!} />

      {/* Danger Zone — destructive operations live here, separated from
          the rest of the page so they can't be clicked by accident. */}
      <div className="bg-white rounded-lg border-2 border-red-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-red-200 bg-red-50 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>
        </div>
        {/* Delete chart of accounts — only before any transactions exist. */}
        <div className="p-6 flex items-center justify-between gap-4 border-b border-red-100">
          <div className="text-sm">
            <p className="font-medium text-gray-900">Delete chart of accounts</p>
            <p className="text-gray-600 mt-1">
              Removes the {tenant.stats.nonSystemAccountCount} non-system accounts so a different COA
              template can be re-seeded. System accounts (Payments Clearing, A/R, A/P, …) are kept.
              Only available before any transactions are recorded
              {tenant.stats.transactionCount > 0
                ? ` — this tenant has ${tenant.stats.transactionCount} transaction(s), so it's blocked.`
                : '.'}
            </p>
            {coaError && <p className="text-red-700 mt-1">{coaError}</p>}
          </div>
          <button
            onClick={() => { setCoaError(null); setShowDeleteCoa(true); }}
            disabled={tenant.stats.transactionCount > 0 || tenant.stats.nonSystemAccountCount === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 border border-red-300 hover:bg-red-50 rounded-lg whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4" />
            Delete chart of accounts
          </button>
        </div>
        {/* Delete all transactions — books reset, everything else kept. */}
        <div className="p-6 flex items-center justify-between gap-4 border-b border-red-100">
          <div className="text-sm">
            <p className="font-medium text-gray-900">Delete all transactions</p>
            <p className="text-gray-600 mt-1">
              Removes all {tenant.stats.transactionCount} transactions and journal lines — a books
              reset. Keeps the chart of accounts, contacts, companies, users, and settings; bank-feed
              items return to pending and account balances reset to zero. This cannot be undone.
            </p>
            {txnError && <p className="text-red-700 mt-1">{txnError}</p>}
          </div>
          <button
            onClick={() => { setTxnError(null); setTxnConfirmText(''); setShowDeleteTxns(true); }}
            disabled={tenant.stats.transactionCount === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 border border-red-300 hover:bg-red-50 rounded-lg whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4" />
            Delete all transactions
          </button>
        </div>
        {/* Delete transactions in a date range — surgical books edit. */}
        <div className="p-6 flex items-center justify-between gap-4 border-b border-red-100">
          <div className="text-sm flex-1">
            <p className="font-medium text-gray-900">Delete transactions in a date range</p>
            <p className="text-gray-600 mt-1">
              Permanently deletes every transaction dated within the range, plus bank-feed items by
              feed date and any reconciliation whose statement date falls in the range. Account
              balances are recomputed from the surviving entries. This cannot be undone.
            </p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <input
                type="date"
                aria-label="Start date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                aria-label="End date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            onClick={() => { setRangeError(null); setRangeConfirmText(''); setShowDeleteRange(true); }}
            disabled={!rangeValid || tenant.stats.transactionCount === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 border border-red-300 hover:bg-red-50 rounded-lg whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CalendarRange className="h-4 w-4" />
            Delete date range
          </button>
        </div>
        {/* Delete payroll import history — record-only cleanup. */}
        <div className="p-6 flex items-center justify-between gap-4 border-b border-red-100">
          <div className="text-sm">
            <p className="font-medium text-gray-900">Delete payroll import history</p>
            <p className="text-gray-600 mt-1">
              Removes all payroll import-history records for this tenant. The posted journal entries
              those imports created are <strong>kept</strong> in the ledger — this only clears the
              import log. This cannot be undone.
            </p>
            {payrollError && <p className="text-red-700 mt-1">{payrollError}</p>}
          </div>
          <button
            onClick={() => { setPayrollError(null); setShowDeletePayroll(true); }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-red-700 border border-red-300 hover:bg-red-50 rounded-lg whitespace-nowrap"
          >
            <Trash2 className="h-4 w-4" />
            Delete payroll history
          </button>
        </div>
        <div className="p-6 flex items-center justify-between gap-4">
          <div className="text-sm">
            <p className="font-medium text-gray-900">Delete this tenant</p>
            <p className="text-gray-600 mt-1">
              Permanently removes <strong>{tenant.name}</strong> and all of its data — chart of
              accounts, transactions, contacts, attachments, audit history, and access records.
              This cannot be undone.
            </p>
          </div>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg whitespace-nowrap"
          >
            <Trash2 className="h-4 w-4" />
            Delete tenant
          </button>
        </div>
      </div>

      {/* Delete-all-transactions confirmation — type-to-confirm. */}
      {showDeleteTxns && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => { if (!deleteTxnsMutation.isPending) setShowDeleteTxns(false); }}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Delete all transactions?</h3>
            </div>
            <div className="text-sm text-gray-700 space-y-2">
              <p>
                This permanently deletes <strong>{tenant.stats.transactionCount} transactions</strong> and
                their journal lines for <strong>{tenant.name}</strong> — including invoices, bills,
                payments, reconciliations, and recurring schedules. Account balances reset to zero;
                bank-feed items return to pending. The chart of accounts, contacts, and settings are kept.
              </p>
            </div>
            <div className="pt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To confirm, type <span className="font-mono font-bold text-red-700">{tenant.name}</span> below:
              </label>
              <input
                type="text"
                value={txnConfirmText}
                onChange={(e) => setTxnConfirmText(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
                placeholder={tenant.name}
                autoFocus
                disabled={deleteTxnsMutation.isPending}
              />
            </div>
            {txnError && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{txnError}</div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteTxns(false)}
                disabled={deleteTxnsMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => { setTxnError(null); deleteTxnsMutation.mutate(); }}
                disabled={txnConfirmText !== tenant.name || deleteTxnsMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg"
              >
                {deleteTxnsMutation.isPending ? 'Deleting…' : 'Delete all transactions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Company hard-delete confirmation — type the company name to confirm. */}
      {deleteCompanyId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => { if (!deleteCompanyMutation.isPending) setDeleteCompanyId(null); }}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Delete company?</h3>
            </div>
            <p className="text-sm text-gray-700">
              This permanently deletes <strong>{deleteCompanyName}</strong> and <strong>all of its
              data</strong> — transactions, journal lines, invoices, bills, banking, and any
              company-scoped accounts and contacts. The tenant and its other companies are kept.
              This cannot be undone.
            </p>
            <div className="pt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To confirm, type <span className="font-mono font-bold text-red-700">{deleteCompanyName}</span> below:
              </label>
              <input
                type="text"
                value={companyConfirmText}
                onChange={(e) => setCompanyConfirmText(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
                placeholder={deleteCompanyName}
                autoFocus
                disabled={deleteCompanyMutation.isPending}
              />
            </div>
            {companyDeleteError && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{companyDeleteError}</div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setDeleteCompanyId(null)} disabled={deleteCompanyMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50">Cancel</button>
              <button onClick={() => { setCompanyDeleteError(null); deleteCompanyMutation.mutate(); }}
                disabled={companyConfirmText !== deleteCompanyName || deleteCompanyMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg">
                {deleteCompanyMutation.isPending ? 'Deleting…' : 'Delete company'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payroll import history purge confirmation — record-only. */}
      {showDeletePayroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => { if (!deletePayrollMutation.isPending) setShowDeletePayroll(false); }}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Delete payroll import history?</h3>
            </div>
            <p className="text-sm text-gray-700">
              This removes every payroll import-history record for <strong>{tenant.name}</strong>. The
              posted journal entries those imports created stay in the ledger — only the import log is
              cleared. This cannot be undone.
            </p>
            {payrollError && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{payrollError}</div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowDeletePayroll(false)} disabled={deletePayrollMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50">Cancel</button>
              <button onClick={() => { setPayrollError(null); deletePayrollMutation.mutate(); }}
                disabled={deletePayrollMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 rounded-lg">
                {deletePayrollMutation.isPending ? 'Deleting…' : 'Delete payroll history'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete-transactions-in-range confirmation — shows a live
          preview of what will be removed, then type-to-confirm. */}
      {showDeleteRange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => { if (!deleteRangeMutation.isPending) setShowDeleteRange(false); }}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Delete transactions in date range?</h3>
            </div>
            <div className="text-sm text-gray-700 space-y-2">
              {rangePreview.isLoading ? (
                <p>Counting what will be deleted…</p>
              ) : rangePreview.error ? (
                <p className="text-red-700">Failed to load preview: {(rangePreview.error as Error).message}</p>
              ) : rangePreview.data ? (
                <p>
                  This will permanently delete{' '}
                  <strong>{rangePreview.data.transactionsToDelete} transaction(s)</strong>,{' '}
                  <strong>{rangePreview.data.feedItemsToDelete} bank feed item(s)</strong>, and{' '}
                  <strong>{rangePreview.data.reconciliationsToDelete} reconciliation(s)</strong> for{' '}
                  <strong>{tenant.name}</strong> dated{' '}
                  <span className="font-mono">{rangeStart}</span> …{' '}
                  <span className="font-mono">{rangeEnd}</span>. Account balances will be recomputed.
                  This cannot be undone.
                </p>
              ) : null}
            </div>
            <div className="pt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To confirm, type <span className="font-mono font-bold text-red-700">{tenant.name}</span> below:
              </label>
              <input
                type="text"
                value={rangeConfirmText}
                onChange={(e) => setRangeConfirmText(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
                placeholder={tenant.name}
                autoFocus
                disabled={deleteRangeMutation.isPending}
              />
            </div>
            {rangeError && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{rangeError}</div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowDeleteRange(false)}
                disabled={deleteRangeMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => { setRangeError(null); deleteRangeMutation.mutate(); }}
                disabled={rangeConfirmText !== tenant.name || deleteRangeMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg"
              >
                {deleteRangeMutation.isPending ? 'Deleting…' : 'Delete date range'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showDeleteCoa}
        title="Delete chart of accounts?"
        message={`This deletes the ${tenant.stats.nonSystemAccountCount} non-system accounts for "${tenant.name}" (system accounts like Payments Clearing, A/R and A/P are kept). You'll need to re-seed a chart of accounts before recording transactions. This is only allowed because the tenant has no transactions yet.`}
        confirmLabel={deleteCoaMutation.isPending ? 'Deleting…' : 'Delete accounts'}
        variant="danger"
        onCancel={() => { if (!deleteCoaMutation.isPending) setShowDeleteCoa(false); }}
        onConfirm={() => deleteCoaMutation.mutate()}
      />


      {/* Delete confirmation modal — type-to-confirm pattern so a
          stray click can't trigger destruction. */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={closeDeleteModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Delete this tenant?</h3>
            </div>

            <div className="text-sm text-gray-700 space-y-2">
              <p>
                This will permanently delete <strong>{tenant.name}</strong> and ALL of its data:
              </p>
              <ul className="list-disc pl-5 space-y-0.5 text-gray-600">
                <li>{tenant.stats.accountCount} chart-of-account entries</li>
                <li>{tenant.stats.transactionCount} transactions and journal lines</li>
                <li>{tenant.stats.contactCount} contacts</li>
                <li>{tenant.companies.length} {tenant.companies.length === 1 ? 'company' : 'companies'}</li>
                <li>All attachments, bank rules, recurring schedules, audit history, and reports</li>
              </ul>
              <p className="text-xs text-gray-500 pt-1">
                Users whose home tenant is this one will be reassigned to another tenant they have
                access to. If any user has no other access, the deletion will be rejected and you'll
                see which users need attention first.
              </p>
            </div>

            <div className="pt-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                To confirm, type <span className="font-mono font-bold text-red-700">{tenant.name}</span> below:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
                placeholder={tenant.name}
                autoFocus
                disabled={deleteMutation.isPending}
              />
            </div>

            {deleteError && (
              <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeDeleteModal}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setDeleteError(null);
                  deleteMutation.mutate();
                }}
                disabled={deleteConfirmText !== tenant.name || deleteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddFirmUser && (
        <AddFirmUserModal
          tenantId={id!}
          existingActiveUserIds={new Set(tenant.users.filter((u) => u.isActive).map((u) => u.id))}
          onClose={() => setShowAddFirmUser(false)}
        />
      )}
    </div>
  );
}

// Grant an existing firm-member user access to THIS tenant. Searchable list of
// firm users (no UUID typing), a role, and one Grant. Reuses the admin
// grant-tenant-access endpoint.
function AddFirmUserModal({
  tenantId,
  existingActiveUserIds,
  onClose,
}: {
  tenantId: string;
  existingActiveUserIds: Set<string>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [role, setRole] = useState('accountant');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'firm-users'],
    queryFn: () =>
      apiClient<{ users: Array<{ id: string; email: string; displayName: string | null; firmNames: string[] }> }>(
        '/admin/firm-users',
      ),
  });

  const grant = useMutation({
    mutationFn: () =>
      apiClient(`/admin/users/${selected}/grant-tenant-access`, {
        method: 'POST',
        body: JSON.stringify({ tenantId, role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', tenantId] });
      onClose();
    },
    onError: (e: Error) => setError(e.message || 'Failed to grant access'),
  });

  const q = query.trim().toLowerCase();
  // Firm users who don't already have active access to this tenant.
  const candidates = (data?.users ?? []).filter((u) => !existingActiveUserIds.has(u.id));
  const matches = q
    ? candidates.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.displayName || '').toLowerCase().includes(q) ||
          u.firmNames.some((f) => f.toLowerCase().includes(q)),
      )
    : candidates;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Add firm user to tenant</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-xs text-gray-500">Grant a firm staff member access to this tenant. Pick a person and a role.</p>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white pl-8 pr-2 py-1.5 text-sm"
            placeholder="Search firm users by email, name, or firm…"
            autoFocus
          />
        </div>

        {isLoading ? (
          <LoadingSpinner size="md" />
        ) : candidates.length === 0 ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            No firm users available to add. (Firm users are members of a firm under Practice → Firm → Staff, who don&apos;t already have active access here.)
          </p>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-md border border-gray-200 divide-y divide-gray-100">
            {matches.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-500">No firm users match “{query}”.</p>
            ) : (
              matches.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelected(u.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-50 ${selected === u.id ? 'bg-primary-50' : ''}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-gray-900">{u.displayName || u.email}</span>
                    <span className="block truncate text-[11px] text-gray-500">
                      {u.email}{u.firmNames.length ? ` · ${u.firmNames.join(', ')}` : ''}
                    </span>
                  </span>
                  {selected === u.id && <span className="ml-2 text-xs font-medium text-primary-600">Selected</span>}
                </button>
              ))
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-700">Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm">
            <option value="owner">owner</option>
            <option value="accountant">accountant</option>
            <option value="bookkeeper">bookkeeper</option>
            <option value="readonly">readonly</option>
          </select>
        </div>

        {error && <p className="text-xs text-rose-700">{error}</p>}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
          <button
            onClick={() => { setError(null); grant.mutate(); }}
            disabled={!selected || grant.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 rounded-lg"
          >
            {grant.isPending ? 'Granting…' : 'Grant access'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Super-admin repair for a tenant whose system Retained Earnings account was
// deleted: pick an equity account and tag it as the system RE (system_tag =
// 'retained_earnings'). Restores closing-entry targeting, system-account
// protection, and the named RE row on the balance sheet.
interface RetainedEarningsAccount { id: string; name: string; accountNumber: string | null; systemTag: string | null; isSystem: boolean }
function RetainedEarningsCard({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tenants', tenantId, 'retained-earnings'],
    queryFn: () => apiClient<{ current: RetainedEarningsAccount | null; equityAccounts: RetainedEarningsAccount[] }>(
      `/admin/tenants/${tenantId}/retained-earnings`,
    ),
  });

  const designate = useMutation({
    mutationFn: () => apiClient(`/admin/tenants/${tenantId}/retained-earnings`, {
      method: 'POST', body: JSON.stringify({ accountId: selected }),
    }),
    onSuccess: () => {
      setSelected(''); setError(null);
      toast.success('Retained Earnings designated.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', tenantId, 'retained-earnings'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'tenants', tenantId] });
    },
    onError: (e: Error) => setError(e.message || 'Could not designate the account'),
  });

  const current = data?.current ?? null;
  const equity = data?.equityAccounts ?? [];
  const label = (a: RetainedEarningsAccount) => `${a.accountNumber ? `${a.accountNumber} — ` : ''}${a.name}`;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">System Retained Earnings</h2>
      </div>
      <div className="p-6 space-y-3">
        {isLoading ? (
          <LoadingSpinner size="md" />
        ) : (
          <>
            {current ? (
              <p className="text-sm text-gray-700">
                Current: <span className="font-medium text-gray-900">{label(current)}</span>{' '}
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">system</span>
              </p>
            ) : (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                No system Retained Earnings account. The balance sheet is showing a <em>calculated</em>
                {' '}Retained Earnings. Designate an equity account below to restore it.
              </p>
            )}

            {equity.length === 0 ? (
              <p className="text-sm text-gray-500">This tenant has no equity accounts to designate.</p>
            ) : (
              <div className="flex items-end gap-2 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {current ? 'Reassign to a different equity account' : 'Designate an equity account'}
                  </label>
                  <select value={selected} onChange={(e) => { setSelected(e.target.value); setError(null); }}
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                    <option value="">Select an equity account…</option>
                    {equity.map((a) => (
                      <option key={a.id} value={a.id} disabled={a.id === current?.id}>
                        {label(a)}{a.id === current?.id ? ' (current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => { setError(null); designate.mutate(); }}
                  disabled={!selected || designate.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 rounded-lg whitespace-nowrap"
                >
                  {designate.isPending ? 'Saving…' : 'Designate as Retained Earnings'}
                </button>
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
