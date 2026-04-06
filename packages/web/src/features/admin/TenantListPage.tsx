import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient, setTokens } from '../../api/client';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Building2, Eye, Power, LogIn, Search } from 'lucide-react';

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  userCount: number;
  companyCount: number;
  transactionCount: number;
  isActive: boolean;
  createdAt: string;
}

export function TenantListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: tenants, isLoading, error } = useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: async () => {
      const res = await apiClient<{ tenants: TenantRow[] }>('/admin/tenants');
      return res.tenants;
    },
  });

  const disableMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/admin/tenants/${id}/disable`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] }),
  });

  const enableMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient(`/admin/tenants/${id}/enable`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] }),
  });

  const handleSwitchToTenant = async (tenantId: string) => {
    try {
      const result = await apiClient<{ tokens: { accessToken: string; refreshToken: string } }>('/auth/switch-tenant', {
        method: 'POST',
        body: JSON.stringify({ tenantId }),
      });
      setTokens(result.tokens);
      queryClient.clear();
      window.location.href = '/';
    } catch {
      alert('Failed to switch tenant. You may not have access.');
    }
  };

  if (isLoading) return <LoadingSpinner className="py-12" />;

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load tenants. {(error as Error)?.message}
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

  const query = search.toLowerCase().trim();
  const filtered = query
    ? tenants?.filter((t) =>
        t.name.toLowerCase().includes(query) ||
        t.slug.toLowerCase().includes(query)
      )
    : tenants;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <span className="text-sm text-gray-500">({filtered?.length ?? 0} of {tenants?.length ?? 0})</span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tenants..."
            className="pl-9 pr-4 py-2 rounded-lg border border-gray-300 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      {!filtered || filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {search ? 'No tenants match your search.' : 'No tenants found.'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Slug</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Users</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Companies</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Transactions</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Created</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/admin/tenants/${t.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                    <td className="px-4 py-3 text-gray-600">{t.slug}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{t.userCount}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{t.companyCount}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{t.transactionCount}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            if (confirm(`Switch to "${t.name}"? This will reload the app.`)) {
                              handleSwitchToTenant(t.id);
                            }
                          }}
                          className="p-1.5 rounded hover:bg-gray-200 text-blue-600"
                          title="Switch to this tenant"
                        >
                          <LogIn className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/admin/tenants/${t.id}`)}
                          className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                          title="View Detail"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (t.isActive) {
                              if (confirm(`Disable tenant "${t.name}"?`)) {
                                disableMutation.mutate(t.id);
                              }
                            } else {
                              enableMutation.mutate(t.id);
                            }
                          }}
                          className={`p-1.5 rounded hover:bg-gray-200 ${
                            t.isActive ? 'text-green-600' : 'text-red-500'
                          }`}
                          title={t.isActive ? 'Disable' : 'Enable'}
                        >
                          <Power className="h-4 w-4" />
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
