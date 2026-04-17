// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ArrowLeft, Building2, Users, Briefcase, BarChart3, Power, Trash2, AlertTriangle } from 'lucide-react';

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
    contactCount: number;
    transactionCount: number;
  };
}

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Delete confirmation state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ['admin', 'tenants', id],
    queryFn: async () => {
      const res = await apiClient<any>(`/admin/tenants/${id}`);
      return {
        id: res.tenant.id,
        name: res.tenant.name,
        slug: res.tenant.slug,
        isActive: true,
        createdAt: res.tenant.createdAt || res.tenant.created_at,
        users: res.users,
        companies: (res.companies || []).map((c: any) => ({
          id: c.id,
          name: c.businessName || c.business_name || c.name,
          isSetupComplete: c.setupComplete ?? c.setup_complete ?? false,
        })),
        stats: {
          accountCount: parseInt(res.stats?.accounts || '0'),
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
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
          <Users className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Users ({tenant.users.length})
          </h2>
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
                        onClick={() => {
                          if (confirm(`${u.isActive ? 'Revoke' : 'Grant'} access for "${u.email}" to this tenant?`)) {
                            toggleAccessMutation.mutate(u.id);
                          }
                        }}
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
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Danger Zone — destructive operations live here, separated from
          the rest of the page so they can't be clicked by accident. */}
      <div className="bg-white rounded-lg border-2 border-red-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-red-200 bg-red-50 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <h2 className="text-lg font-semibold text-red-900">Danger Zone</h2>
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
    </div>
  );
}
