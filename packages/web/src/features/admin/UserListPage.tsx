import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, setTokens } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import {
  UsersRound,
  KeyRound,
  Power,
  ShieldCheck,
  UserCog,
  Building2,
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

export function UserListPage() {
  const queryClient = useQueryClient();
  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [companyAccessUserId, setCompanyAccessUserId] = useState<string | null>(null);

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
      alert('Password reset successfully.');
    },
  });

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
      apiClient<{ accessToken: string; refreshToken: string }>(`/admin/impersonate/${userId}`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
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
      <div className="flex items-center gap-3">
        <UsersRound className="h-6 w-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">All Users</h1>
        <span className="text-sm text-gray-500">({users?.length ?? 0} total)</span>
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
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setResetPasswordUserId(null);
                  setNewPassword('');
                }}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (newPassword.length < 6) {
                    alert('Password must be at least 6 characters.');
                    return;
                  }
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

      {!users || users.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          No users found.
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
                {users.map((u) => (
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
                          onClick={() => {
                            if (
                              confirm(
                                `${u.isActive ? 'Deactivate' : 'Activate'} user "${u.email}"?`,
                              )
                            ) {
                              toggleActiveMutation.mutate(u.id);
                            }
                          }}
                          className={`p-1.5 rounded hover:bg-gray-200 ${
                            u.isActive ? 'text-green-600' : 'text-red-500'
                          }`}
                          title={u.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <Power className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `${u.isSuperAdmin ? 'Remove' : 'Grant'} super admin for "${u.email}"?`,
                              )
                            ) {
                              toggleSuperAdminMutation.mutate(u.id);
                            }
                          }}
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
                          onClick={() => {
                            if (confirm(`Impersonate "${u.email}"? This will open a new tab.`)) {
                              impersonateMutation.mutate(u.id);
                            }
                          }}
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
