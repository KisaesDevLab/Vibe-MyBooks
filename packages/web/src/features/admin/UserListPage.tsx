// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, setTokens } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  UsersRound,
  KeyRound,
  Power,
  ShieldCheck,
  UserCog,
  Building2,
  Plus,
  X,
  Eye,
  EyeOff,
  Search,
} from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  displayName: string | null;
  tenantName: string;
  tenantId: string;
  role: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
}

interface TenantOption { id: string; name: string }

export function UserListPage() {
  const queryClient = useQueryClient();
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState('');
  const [pendingAction, setPendingAction] = useState<
    | { title: string; message: string; confirmLabel: string; variant?: 'primary' | 'danger'; onConfirm: () => void }
    | null
  >(null);
  const [companyAccessUserId, setCompanyAccessUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ email: '', password: '', displayName: '', tenantId: '', role: 'owner' });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createError, setCreateError] = useState('');

  const { data: tenantOptions } = useQuery({
    queryKey: ['admin', 'tenants-for-select'],
    queryFn: async () => {
      const res = await apiClient<{ tenants: TenantOption[] }>('/admin/tenants');
      return res.tenants;
    },
  });

  const createUserMutation = useMutation({
    mutationFn: (input: typeof createForm) =>
      apiClient('/admin/users/create', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowCreate(false);
      setCreateForm({ email: '', password: '', displayName: '', tenantId: '', role: 'owner' });
      setCreateError('');
    },
    onError: (err: Error) => setCreateError(err.message || 'Failed to create user'),
  });

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const res = await apiClient<{ users: AdminUser[] }>('/admin/users');
      return res.users;
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      apiClient(`/admin/users/${userId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    onSuccess: () => {
      setResetPasswordUserId(null);
      setNewPassword('');
      setResetPasswordError('');
      setResetPasswordSuccess('Password reset successfully.');
    },
    onError: (err: Error) => setResetPasswordError(err.message || 'Failed to reset password.'),
  });

  useEffect(() => {
    if (!resetPasswordSuccess) return;
    const t = setTimeout(() => setResetPasswordSuccess(''), 3000);
    return () => clearTimeout(t);
  }, [resetPasswordSuccess]);

  const toggleActiveMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient(`/admin/users/${userId}/toggle-active`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const toggleSuperAdminMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient(`/admin/users/${userId}/toggle-super-admin`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const setRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      apiClient(`/admin/users/${userId}/set-role`, {
        method: 'POST',
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const impersonateMutation = useMutation({
    mutationFn: (userId: string) =>
      apiClient<{ accessToken: string }>(`/admin/impersonate/${userId}`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      setTokens({ accessToken: data.accessToken });
      window.open('/', '_blank');
    },
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load users. {(error as Error)?.message}
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

  return (
    <div className="p-6 space-y-6">
      <ConfirmDialog
        open={!!pendingAction}
        title={pendingAction?.title ?? ''}
        message={pendingAction?.message}
        confirmLabel={pendingAction?.confirmLabel ?? 'Confirm'}
        variant={pendingAction?.variant ?? 'primary'}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          pendingAction?.onConfirm();
          setPendingAction(null);
        }}
      />
      {resetPasswordSuccess && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {resetPasswordSuccess}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <UsersRound className="h-6 w-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">All Users</h1>
          <span className="text-sm text-gray-500">({users?.length ?? 0} total)</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users..."
              className="pl-9 pr-4 py-2 rounded-lg border border-gray-300 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" /> New User
          </Button>
        </div>
      </div>

      {/* Reset Password Modal */}
      {resetPasswordUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reset Password</h3>
            <p className="text-sm text-gray-600 mb-3">
              Enter a new password for{' '}
              <strong>{users?.find((u) => u.id === resetPasswordUserId)?.email}</strong>
            </p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (resetPasswordError) setResetPasswordError('');
              }}
              placeholder="New password (min 8 characters)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            {resetPasswordError && (
              <p role="alert" className="mt-2 text-xs text-red-600">{resetPasswordError}</p>
            )}
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setResetPasswordUserId(null);
                  setNewPassword('');
                  setResetPasswordError('');
                }}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newPassword.length < 8) {
                    setResetPasswordError('Password must be at least 8 characters.');
                    return;
                  }
                  setResetPasswordError('');
                  resetPasswordMutation.mutate({
                    userId: resetPasswordUserId,
                    password: newPassword,
                  });
                }}
                disabled={resetPasswordMutation.isPending}
                className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Company Access Modal */}
      {companyAccessUserId && (
        <CompanyAccessModal userId={companyAccessUserId} onClose={() => setCompanyAccessUserId(null)} />
      )}

      {(() => {
        const query = search.toLowerCase().trim();
        const filtered = query
          ? users?.filter(u => u.email.toLowerCase().includes(query) || (u.displayName || '').toLowerCase().includes(query) || u.tenantName.toLowerCase().includes(query))
          : users;
        return !filtered || filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {search ? 'No users match your search.' : 'No users found.'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Display Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Tenant</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Active</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Super Admin</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Last Login</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-900">{u.email}</td>
                    <td className="px-4 py-3 text-gray-700">{u.displayName || '-'}</td>
                    <td className="px-4 py-3 text-gray-700">{u.tenantName}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => setRoleMutation.mutate({ userId: u.id, role: e.target.value })}
                        className="text-xs font-medium px-2 py-1 rounded-lg border border-gray-200 bg-white"
                      >
                        <option value="owner">Owner</option>
                        <option value="accountant">Accountant</option>
                        <option value="bookkeeper">Bookkeeper</option>
                      </select>
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
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setResetPasswordUserId(u.id)}
                          className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                          title="Reset Password"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            setPendingAction({
                              title: `${u.isActive ? 'Deactivate' : 'Activate'} user?`,
                              message: `${u.isActive ? 'Deactivate' : 'Activate'} user "${u.email}".`,
                              confirmLabel: u.isActive ? 'Deactivate' : 'Activate',
                              variant: u.isActive ? 'danger' : 'primary',
                              onConfirm: () => toggleActiveMutation.mutate(u.id),
                            })
                          }
                          className={`p-1.5 rounded hover:bg-gray-200 ${
                            u.isActive ? 'text-green-600' : 'text-red-500'
                          }`}
                          title={u.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <Power className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            setPendingAction({
                              title: `${u.isSuperAdmin ? 'Remove' : 'Grant'} super admin?`,
                              message: `${u.isSuperAdmin ? 'Remove' : 'Grant'} super admin privileges for "${u.email}".`,
                              confirmLabel: u.isSuperAdmin ? 'Remove' : 'Grant',
                              variant: u.isSuperAdmin ? 'danger' : 'primary',
                              onConfirm: () => toggleSuperAdminMutation.mutate(u.id),
                            })
                          }
                          className={`p-1.5 rounded hover:bg-gray-200 ${
                            u.isSuperAdmin ? 'text-purple-600' : 'text-gray-400'
                          }`}
                          title={u.isSuperAdmin ? 'Remove Super Admin' : 'Grant Super Admin'}
                        >
                          <ShieldCheck className="h-4 w-4" />
                        </button>
                        {(u.role === 'accountant' || u.role === 'bookkeeper') && (
                          <button
                            onClick={() => setCompanyAccessUserId(u.id)}
                            className="p-1.5 rounded hover:bg-gray-200 text-blue-600"
                            title="Manage Company Access"
                          >
                            <Building2 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() =>
                            setPendingAction({
                              title: 'Impersonate user?',
                              message: `Open a new tab impersonating "${u.email}".`,
                              confirmLabel: 'Impersonate',
                              variant: 'primary',
                              onConfirm: () => impersonateMutation.mutate(u.id),
                            })
                          }
                          className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                          title="Impersonate"
                        >
                          <UserCog className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
      })()}

      {/* Create User Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">New User</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                if (!createForm.email || !createForm.password || !createForm.tenantId) return;
                if (createForm.password.length < 8) { setCreateError('Password must be at least 8 characters'); return; }
                createUserMutation.mutate(createForm);
              }}
              className="px-6 py-4 space-y-4"
            >
              <Input
                label="Email *"
                type="email"
                value={createForm.email}
                onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                placeholder="user@example.com"
                autoFocus
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">Password *</label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    value={createForm.password}
                    onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Min 8 characters"
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Input
                label="Display Name"
                value={createForm.displayName}
                onChange={e => setCreateForm(f => ({ ...f, displayName: e.target.value }))}
                placeholder="John Smith"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tenant / Company *</label>
                <select
                  value={createForm.tenantId}
                  onChange={e => setCreateForm(f => ({ ...f, tenantId: e.target.value }))}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select tenant...</option>
                  {tenantOptions?.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={createForm.role}
                  onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="owner">Owner</option>
                  <option value="accountant">Accountant</option>
                  <option value="bookkeeper">Bookkeeper</option>
                </select>
              </div>
              {createError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{createError}</div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" loading={createUserMutation.isPending} disabled={!createForm.email || !createForm.password || !createForm.tenantId}>
                  Create User
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CompanyAccessModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', userId, 'company-access'],
    queryFn: () => apiClient<{
      userId: string; email: string; role: string;
      companies: Array<{ id: string; businessName: string; hasAccess: boolean }>;
    }>(`/admin/users/${userId}/company-access`),
  });

  const excludeMutation = useMutation({
    mutationFn: (companyId: string) =>
      apiClient(`/admin/users/${userId}/exclude-company`, {
        method: 'POST', body: JSON.stringify({ companyId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId, 'company-access'] }),
  });

  const includeMutation = useMutation({
    mutationFn: (companyId: string) =>
      apiClient(`/admin/users/${userId}/include-company`, {
        method: 'POST', body: JSON.stringify({ companyId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId, 'company-access'] }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Company Access</h3>
        <p className="text-sm text-gray-500 mb-4">
          {data?.email} ({data?.role})
        </p>
        {isLoading ? (
          <div className="py-8 text-center text-gray-400">Loading...</div>
        ) : (
          <div className="space-y-2">
            {data?.companies.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                <span className="text-sm font-medium text-gray-900">{c.businessName}</span>
                <button
                  onClick={() => c.hasAccess ? excludeMutation.mutate(c.id) : includeMutation.mutate(c.id)}
                  className={`text-xs font-medium px-3 py-1 rounded-full ${
                    c.hasAccess
                      ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700'
                      : 'bg-red-100 text-red-700 hover:bg-green-100 hover:text-green-700'
                  }`}
                >
                  {c.hasAccess ? 'Has Access' : 'Excluded'}
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">Done</button>
        </div>
      </div>
    </div>
  );
}
