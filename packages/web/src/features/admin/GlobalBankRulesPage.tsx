import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Plus, Pencil, Trash2, Globe, X, CheckCircle, XCircle, Inbox } from 'lucide-react';

interface GlobalRule {
  id: string;
  name: string;
  priority: number;
  isActive: boolean;
  applyTo: string;
  descriptionContains: string | null;
  descriptionExact: string | null;
  amountEquals: string | null;
  amountMin: string | null;
  amountMax: string | null;
  assignAccountName: string | null;
  assignContactName: string | null;
  assignMemo: string | null;
  autoConfirm: boolean;
  timesApplied: number;
}

const emptyForm = {
  name: '', applyTo: 'both', descriptionContains: '', descriptionExact: '',
  amountEquals: '', amountMin: '', amountMax: '',
  assignAccountName: '', assignContactName: '', assignMemo: '',
  autoConfirm: false, priority: 0,
};

export function GlobalBankRulesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'bank-rules'],
    queryFn: async () => {
      const res = await apiClient<{ rules: GlobalRule[] }>('/admin/bank-rules');
      return res.rules;
    },
  });

  const createMutation = useMutation({
    mutationFn: (input: any) => apiClient('/admin/bank-rules', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'bank-rules'] }); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...input }: any) => apiClient(`/admin/bank-rules/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'bank-rules'] }); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/admin/bank-rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'bank-rules'] }),
  });

  const { data: submissions } = useQuery({
    queryKey: ['admin', 'bank-rule-submissions'],
    queryFn: async () => {
      const res = await apiClient<{ submissions: any[] }>('/admin/bank-rule-submissions?status=pending');
      return res.submissions;
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/admin/bank-rule-submissions/${id}/approve`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bank-rules'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'bank-rule-submissions'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/admin/bank-rule-submissions/${id}/reject`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'bank-rule-submissions'] }),
  });

  const resetForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };

  const handleEdit = (rule: GlobalRule) => {
    setForm({
      name: rule.name, applyTo: rule.applyTo, priority: rule.priority,
      descriptionContains: rule.descriptionContains || '', descriptionExact: rule.descriptionExact || '',
      amountEquals: rule.amountEquals || '', amountMin: rule.amountMin || '', amountMax: rule.amountMax || '',
      assignAccountName: rule.assignAccountName || '', assignContactName: rule.assignContactName || '',
      assignMemo: rule.assignMemo || '', autoConfirm: rule.autoConfirm,
    });
    setEditingId(rule.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    const payload = {
      ...form,
      descriptionContains: form.descriptionContains || null,
      descriptionExact: form.descriptionExact || null,
      amountEquals: form.amountEquals || null,
      amountMin: form.amountMin || null,
      amountMax: form.amountMax || null,
      assignAccountName: form.assignAccountName || null,
      assignContactName: form.assignContactName || null,
      assignMemo: form.assignMemo || null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Global Bank Rules</h1>
          <span className="text-sm text-gray-500">({data?.length ?? 0} rules)</span>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-1" /> New Rule
        </Button>
      </div>

      <p className="text-sm text-gray-500">
        Global rules apply to all tenants as a fallback when no tenant-specific rule matches. Categories are matched by name to each tenant's chart of accounts. Missing contacts are auto-created.
      </p>

      {/* Rule Form */}
      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">{editingId ? 'Edit Rule' : 'New Rule'}</h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Rule Name" value={form.name} onChange={set('name')} required />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apply To</label>
                <select value={form.applyTo} onChange={set('applyTo')} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="both">Both</option>
                  <option value="expenses">Expenses</option>
                  <option value="deposits">Deposits</option>
                </select>
              </div>
              <Input label="Priority" value={String(form.priority)} onChange={(e) => setForm((f) => ({ ...f, priority: parseInt(e.target.value) || 0 }))} type="number" />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Conditions (match when...)</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Description Contains" value={form.descriptionContains} onChange={set('descriptionContains')} placeholder="e.g., AMZN" />
              <Input label="Description Exact" value={form.descriptionExact} onChange={set('descriptionExact')} />
              <Input label="Amount Equals" value={form.amountEquals} onChange={set('amountEquals')} type="number" />
              <div className="grid grid-cols-2 gap-2">
                <Input label="Amount Min" value={form.amountMin} onChange={set('amountMin')} type="number" />
                <Input label="Amount Max" value={form.amountMax} onChange={set('amountMax')} type="number" />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Actions (assign...)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Input label="Category (Account Name)" value={form.assignAccountName} onChange={set('assignAccountName')} placeholder="e.g., Office Supplies" />
                <p className="text-xs text-gray-400 mt-1">Fuzzy-matched to each tenant's chart of accounts</p>
              </div>
              <div>
                <Input label="Contact Name" value={form.assignContactName} onChange={set('assignContactName')} placeholder="e.g., Amazon" />
                <p className="text-xs text-gray-400 mt-1">Auto-created if not found in tenant</p>
              </div>
              <Input label="Memo" value={form.assignMemo} onChange={set('assignMemo')} />
              <label className="flex items-center gap-2 self-end py-2">
                <input type="checkbox" checked={form.autoConfirm}
                  onChange={(e) => setForm((f) => ({ ...f, autoConfirm: e.target.checked }))}
                  className="rounded border-gray-300 text-primary-600" />
                <span className="text-sm text-gray-700">Auto-confirm on match</span>
              </label>
            </div>
          </div>

          {(createMutation.error || updateMutation.error) && (
            <p className="text-sm text-red-600">{(createMutation.error || updateMutation.error)?.message}</p>
          )}

          <div className="flex gap-3">
            <Button onClick={handleSubmit} loading={createMutation.isPending || updateMutation.isPending} disabled={!form.name}>
              {editingId ? 'Save Changes' : 'Create Rule'}
            </Button>
            <Button variant="secondary" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Pending Submissions */}
      {submissions && submissions.length > 0 && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Inbox className="h-5 w-5 text-amber-600" />
            <h2 className="text-sm font-semibold text-amber-800">Pending Submissions ({submissions.length})</h2>
          </div>
          <div className="space-y-2">
            {submissions.map((sub: any) => (
              <div key={sub.id} className="bg-white rounded-lg border border-amber-100 p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">{sub.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    From: {sub.submittedByEmail}
                    {sub.descriptionContains && <span> | Contains: "{sub.descriptionContains}"</span>}
                    {sub.assignAccountName && <span> | Category: {sub.assignAccountName}</span>}
                    {sub.assignContactName && <span> | Contact: {sub.assignContactName}</span>}
                  </div>
                  {sub.note && <div className="text-xs text-gray-400 mt-1 italic">"{sub.note}"</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => approveMutation.mutate(sub.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
                  >
                    <CheckCircle className="h-3.5 w-3.5" /> Approve
                  </button>
                  <button
                    onClick={() => { if (confirm('Reject this submission?')) rejectMutation.mutate(sub.id); }}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rules Table */}
      {!data || data.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          No global rules yet. Create one to apply across all tenants.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Conditions</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Category</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Contact</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Applied</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((rule) => (
                <tr key={rule.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{rule.name}</div>
                    <div className="text-xs text-gray-400">Priority: {rule.priority} | {rule.applyTo}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {rule.descriptionContains && <div>Contains: "{rule.descriptionContains}"</div>}
                    {rule.descriptionExact && <div>Exact: "{rule.descriptionExact}"</div>}
                    {rule.amountEquals && <div>Amount = ${rule.amountEquals}</div>}
                    {(rule.amountMin || rule.amountMax) && <div>Amount: {rule.amountMin || '0'} - {rule.amountMax || '∞'}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{rule.assignAccountName || '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{rule.assignContactName || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{rule.timesApplied}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => handleEdit(rule)} className="p-1.5 rounded hover:bg-gray-200 text-gray-600" title="Edit">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button onClick={() => { if (confirm(`Delete rule "${rule.name}"?`)) deleteMutation.mutate(rule.id); }}
                        className="p-1.5 rounded hover:bg-gray-200 text-red-500" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
