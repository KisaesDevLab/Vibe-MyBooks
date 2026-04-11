import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  Save,
  Search,
  Lock,
  Upload,
  Copy,
  Building2,
  X,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import type {
  CoaTemplate,
  CoaTemplateAccountInput,
  CoaTemplateSummary,
} from '@kis-books/shared';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const;
type AccountType = (typeof ACCOUNT_TYPES)[number];

const DETAIL_TYPES_BY_ACCOUNT_TYPE: Record<AccountType, string[]> = {
  asset: ['bank', 'accounts_receivable', 'other_current_asset', 'fixed_asset', 'other_asset'],
  liability: ['accounts_payable', 'credit_card', 'other_current_liability', 'long_term_liability'],
  equity: ['owners_equity', 'retained_earnings', 'opening_balance'],
  revenue: ['service', 'sales_of_product', 'other_income', 'interest_earned'],
  expense: [
    'advertising',
    'bank_charges',
    'cost_of_goods_sold',
    'other_cost_of_service',
    'insurance',
    'meals_entertainment',
    'office_supplies',
    'legal_professional',
    'rent_or_lease',
    'repairs_maintenance',
    'utilities',
    'travel',
    'payroll_expenses',
    'other_expense',
  ],
};

interface TenantOption {
  id: string;
  name: string;
}

function emptyAccount(): CoaTemplateAccountInput {
  return {
    accountNumber: '',
    name: '',
    accountType: 'expense',
    detailType: 'other_expense',
    isSystem: false,
    systemTag: null,
  };
}

export function CoaTemplatesPage() {
  const queryClient = useQueryClient();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showClone, setShowClone] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const [editAccounts, setEditAccounts] = useState<CoaTemplateAccountInput[]>([]);
  const [dirty, setDirty] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // List of templates
  const { data: templates, isLoading: listLoading } = useQuery({
    queryKey: ['admin', 'coa-templates'],
    queryFn: async () => {
      const res = await apiClient<{ templates: CoaTemplateSummary[] }>('/admin/coa-templates');
      return res.templates;
    },
  });

  // Selected template detail
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['admin', 'coa-templates', selectedSlug],
    enabled: !!selectedSlug,
    queryFn: async () => {
      const res = await apiClient<{ template: CoaTemplate }>(`/admin/coa-templates/${selectedSlug}`);
      return res.template;
    },
  });

  // Sync editor state when a template is loaded
  useEffect(() => {
    if (detail) {
      setEditLabel(detail.label);
      setEditAccounts(detail.accounts.map((a) => ({ ...a })));
      setDirty(false);
      setErrorMessage(null);
    }
  }, [detail]);

  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) => t.label.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q),
    );
  }, [templates, search]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSlug) throw new Error('No template selected');
      const res = await apiClient<{ template: CoaTemplate }>(`/admin/coa-templates/${selectedSlug}`, {
        method: 'PUT',
        body: JSON.stringify({ label: editLabel, accounts: editAccounts }),
      });
      return res.template;
    },
    onSuccess: () => {
      setDirty(false);
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'coa-templates'] });
    },
    onError: (err: Error) => setErrorMessage(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (slug: string) => {
      await apiClient(`/admin/coa-templates/${slug}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      setSelectedSlug(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'coa-templates'] });
      // Also invalidate the public business-type options so any other
      // tab that's already loaded the dropdown picks up the change.
      queryClient.invalidateQueries({ queryKey: ['coa-template-options'] });
    },
    onError: (err: Error) => setErrorMessage(err.message),
  });

  const hideMutation = useMutation({
    mutationFn: async ({ slug, hidden }: { slug: string; hidden: boolean }) => {
      const res = await apiClient<{ template: CoaTemplate }>(
        `/admin/coa-templates/${slug}/hidden`,
        { method: 'PATCH', body: JSON.stringify({ hidden }) },
      );
      return res.template;
    },
    onSuccess: () => {
      setErrorMessage(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'coa-templates'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'coa-templates', selectedSlug] });
      // Public dropdowns at registration / setup hit /coa-templates/options,
      // which is cached under this key. Invalidate so the change is
      // visible immediately without a page reload.
      queryClient.invalidateQueries({ queryKey: ['coa-template-options'] });
    },
    onError: (err: Error) => setErrorMessage(err.message),
  });

  const handleSelect = (slug: string) => {
    if (dirty && !confirm('You have unsaved changes. Discard them?')) return;
    setSelectedSlug(slug);
  };

  const handleAddRow = () => {
    setEditAccounts((prev) => [...prev, emptyAccount()]);
    setDirty(true);
  };

  const handleRemoveRow = (idx: number) => {
    setEditAccounts((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleRowChange = (idx: number, patch: Partial<CoaTemplateAccountInput>) => {
    setEditAccounts((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const next = { ...row, ...patch };
        // If accountType changed, reset detailType to first valid choice
        if (patch.accountType && patch.accountType !== row.accountType) {
          next.detailType = DETAIL_TYPES_BY_ACCOUNT_TYPE[patch.accountType]?.[0] ?? 'other_expense';
        }
        return next;
      }),
    );
    setDirty(true);
  };

  const handleDelete = () => {
    if (!detail) return;
    if (detail.isBuiltin) {
      setErrorMessage('Built-in templates cannot be deleted.');
      return;
    }
    if (!confirm(`Delete template "${detail.label}"? This cannot be undone.`)) return;
    deleteMutation.mutate(detail.slug);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">COA Templates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage chart-of-accounts templates used when seeding new tenants. Built-in
            templates can be edited freely; hide a template (built-in or custom) to
            remove it from the business-type dropdown without losing its data.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowImport(true)}>
            <Upload className="h-4 w-4 mr-1.5" /> Import
          </Button>
          <Button variant="secondary" onClick={() => setShowClone(true)}>
            <Building2 className="h-4 w-4 mr-1.5" /> From Tenant
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> New Template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: list */}
        <div className="lg:col-span-4 bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          {listLoading ? (
            <LoadingSpinner className="py-8" />
          ) : filteredTemplates.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">No templates found.</div>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-[70vh] overflow-y-auto">
              {filteredTemplates.map((t) => (
                <li key={t.slug}>
                  <button
                    onClick={() => handleSelect(t.slug)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      selectedSlug === t.slug ? 'bg-primary-50 border-l-4 border-primary-500' : ''
                    } ${t.isHidden ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-900 truncate">{t.label}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {t.isHidden && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-gray-600"
                            title="Hidden from registration / setup dropdowns"
                          >
                            <EyeOff className="h-2.5 w-2.5" /> Hidden
                          </span>
                        )}
                        {t.isBuiltin && (
                          <span title="Built-in (cannot be deleted, but editable)">
                            <Lock className="h-3.5 w-3.5 text-gray-400" />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {t.slug} · {t.accountCount} accounts
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: editor */}
        <div className="lg:col-span-8 bg-white rounded-lg border border-gray-200 shadow-sm">
          {!selectedSlug ? (
            <div className="p-12 text-center text-sm text-gray-500">
              Select a template to view or edit its accounts.
            </div>
          ) : detailLoading || !detail ? (
            <LoadingSpinner className="py-12" />
          ) : (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Input
                      label="Label"
                      value={editLabel}
                      onChange={(e) => {
                        setEditLabel(e.target.value);
                        setDirty(true);
                      }}
                    />
                    <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span>
                        Slug: <code className="bg-gray-100 px-1 rounded">{detail.slug}</code>
                      </span>
                      {detail.isBuiltin && (
                        <span className="inline-flex items-center text-gray-600">
                          <Lock className="h-3 w-3 mr-1" /> Built-in — editable, but cannot be deleted
                        </span>
                      )}
                      {detail.isHidden && (
                        <span className="inline-flex items-center text-gray-600">
                          <EyeOff className="h-3 w-3 mr-1" /> Hidden from registration / setup dropdowns
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 pt-6">
                    <Button
                      onClick={() => updateMutation.mutate()}
                      disabled={!dirty || updateMutation.isPending}
                      loading={updateMutation.isPending}
                    >
                      <Save className="h-4 w-4 mr-1.5" /> Save
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => hideMutation.mutate({ slug: detail.slug, hidden: !detail.isHidden })}
                      disabled={hideMutation.isPending}
                      loading={hideMutation.isPending}
                      title={detail.isHidden
                        ? 'Show this template in the business-type dropdowns again'
                        : 'Hide this template from the business-type dropdowns at registration / setup. Existing tenants are unaffected.'}
                    >
                      {detail.isHidden ? (
                        <><Eye className="h-4 w-4 mr-1.5" /> Show</>
                      ) : (
                        <><EyeOff className="h-4 w-4 mr-1.5" /> Hide</>
                      )}
                    </Button>
                    {!detail.isBuiltin && (
                      <Button variant="danger" onClick={handleDelete} disabled={deleteMutation.isPending}>
                        <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                      </Button>
                    )}
                  </div>
                </div>
                {errorMessage && (
                  <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>

              {/* Accounts table */}
              <div className="flex-1 overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">#</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Name</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Type</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Detail</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">System Tag</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {editAccounts.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-2 py-1.5">
                          <input
                            value={row.accountNumber}
                            onChange={(e) => handleRowChange(idx, { accountNumber: e.target.value })}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={row.name}
                            onChange={(e) => handleRowChange(idx, { name: e.target.value })}
                            className="w-full min-w-[180px] px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={row.accountType}
                            onChange={(e) =>
                              handleRowChange(idx, { accountType: e.target.value as AccountType })
                            }
                            className="px-2 py-1 border border-gray-300 rounded text-xs"
                          >
                            {ACCOUNT_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={row.detailType}
                            onChange={(e) => handleRowChange(idx, { detailType: e.target.value })}
                            className="px-2 py-1 border border-gray-300 rounded text-xs"
                          >
                            {DETAIL_TYPES_BY_ACCOUNT_TYPE[row.accountType].map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={row.systemTag ?? ''}
                            onChange={(e) =>
                              handleRowChange(idx, {
                                systemTag: e.target.value || null,
                                isSystem: !!e.target.value,
                              })
                            }
                            placeholder="—"
                            className="w-32 px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <button
                            onClick={() => handleRemoveRow(idx)}
                            className="text-gray-400 hover:text-red-600"
                            title="Remove row"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-3 border-t border-gray-200">
                <Button variant="secondary" size="sm" onClick={handleAddRow}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add Account
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateTemplateModal
          onClose={() => setShowCreate(false)}
          onCreated={(slug) => {
            setShowCreate(false);
            setSelectedSlug(slug);
            queryClient.invalidateQueries({ queryKey: ['admin', 'coa-templates'] });
          }}
        />
      )}
      {showImport && (
        <ImportTemplateModal
          onClose={() => setShowImport(false)}
          onImported={(slug) => {
            setShowImport(false);
            setSelectedSlug(slug);
            queryClient.invalidateQueries({ queryKey: ['admin', 'coa-templates'] });
          }}
        />
      )}
      {showClone && (
        <CloneFromTenantModal
          onClose={() => setShowClone(false)}
          onCloned={(slug) => {
            setShowClone(false);
            setSelectedSlug(slug);
            queryClient.invalidateQueries({ queryKey: ['admin', 'coa-templates'] });
          }}
        />
      )}
    </div>
  );
}

// ─── Create Modal ──────────────────────────────────────────────

function CreateTemplateModal({ onClose, onCreated }: { onClose: () => void; onCreated: (slug: string) => void }) {
  const [slug, setSlug] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient<{ template: CoaTemplate }>('/admin/coa-templates', {
        method: 'POST',
        body: JSON.stringify({
          slug,
          label,
          // Seed with one placeholder account so the create succeeds — admin
          // edits the rest in the main editor.
          accounts: [
            {
              accountNumber: '10100',
              name: 'Cash',
              accountType: 'asset',
              detailType: 'bank',
              isSystem: true,
              systemTag: 'cash_on_hand',
            },
          ],
        }),
      });
      return res.template;
    },
    onSuccess: (t) => onCreated(t.slug),
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Modal title="New COA Template" onClose={onClose}>
      <div className="space-y-3">
        <Input
          label="Slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="my_custom_template"
        />
        <p className="text-xs text-gray-500 -mt-2">
          Lowercase letters, digits, and underscores only. Used internally.
        </p>
        <Input
          label="Display Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="My Custom Template"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!slug || !label || mutation.isPending}
            loading={mutation.isPending}
          >
            Create
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Import Modal ──────────────────────────────────────────────

function ImportTemplateModal({ onClose, onImported }: { onClose: () => void; onImported: (slug: string) => void }) {
  const [json, setJson] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      let payload;
      try {
        payload = JSON.parse(json);
      } catch {
        throw new Error('Invalid JSON');
      }
      const res = await apiClient<{ template: CoaTemplate }>('/admin/coa-templates/import', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.template;
    },
    onSuccess: (t) => onImported(t.slug),
    onError: (err: Error) => setError(err.message),
  });

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setJson(text);
  };

  return (
    <Modal title="Import COA Template" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          Paste a JSON object with <code className="bg-gray-100 px-1 rounded">slug</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">label</code>, and{' '}
          <code className="bg-gray-100 px-1 rounded">accounts</code> fields, or upload a file.
        </p>
        <input type="file" accept=".json,application/json" onChange={handleFile} className="text-sm" />
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          rows={12}
          placeholder='{"slug": "...", "label": "...", "accounts": [...] }'
          className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-xs"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!json || mutation.isPending} loading={mutation.isPending}>
            <Upload className="h-4 w-4 mr-1.5" /> Import
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Clone From Tenant Modal ───────────────────────────────────

function CloneFromTenantModal({ onClose, onCloned }: { onClose: () => void; onCloned: (slug: string) => void }) {
  const [tenantId, setTenantId] = useState('');
  const [slug, setSlug] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: tenants } = useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: async () => {
      const res = await apiClient<{ tenants: TenantOption[] }>('/admin/tenants');
      return res.tenants;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient<{ template: CoaTemplate }>('/admin/coa-templates/from-tenant', {
        method: 'POST',
        body: JSON.stringify({ tenantId, slug, label }),
      });
      return res.template;
    },
    onSuccess: (t) => onCloned(t.slug),
    onError: (err: Error) => setError(err.message),
  });

  return (
    <Modal title="Clone Template From Tenant" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          Reads the active accounts from a tenant and saves them as a new reusable template.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Source Tenant</label>
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="block w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Select a tenant…</option>
            {tenants?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="New Slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="cloned_from_acme"
        />
        <Input
          label="Display Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Cloned from Acme"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!tenantId || !slug || !label || mutation.isPending}
            loading={mutation.isPending}
          >
            <Copy className="h-4 w-4 mr-1.5" /> Clone
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal shell ───────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
