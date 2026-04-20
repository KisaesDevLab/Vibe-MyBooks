// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { ContactSelector } from '../../components/forms/ContactSelector';
import { LineTagPicker } from '../../components/forms/SplitRowV2';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Plus, Pencil, Trash2, X, Globe, Send } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────

interface BankRule {
  id: string;
  name: string;
  applyTo: 'deposits' | 'expenses' | 'both';
  descriptionContains: string | null;
  // Global rules carry this; tenant rules do not.
  descriptionExact?: string | null;
  amountEquals: string | null;
  amountMin: string | null;
  amountMax: string | null;
  assignAccountId: string | null;
  assignAccountName: string | null;
  assignContactId: string | null;
  assignContactName: string | null;
  assignMemo: string | null;
  // ADR 0XY — tag stamped onto journal lines produced when this rule matches.
  assignTagId: string | null;
  autoConfirm: boolean;
  priority: number;
  isActive: boolean;
  timesApplied: number;
}

interface BankRuleInput {
  name: string;
  applyTo: 'deposits' | 'expenses' | 'both';
  descriptionContains: string | null;
  amountEquals: string | null;
  amountMin: string | null;
  amountMax: string | null;
  assignAccountId: string | null;
  assignContactId: string | null;
  assignMemo: string | null;
  assignTagId: string | null;
  autoConfirm: boolean;
  priority: number;
  isActive: boolean;
}

// ─── API Hooks ──────────────────────────────────────────────────────

function useBankRules() {
  return useQuery({
    queryKey: ['bank-rules'],
    queryFn: () => apiClient<{ data: BankRule[]; total: number }>('/bank-rules'),
  });
}

function useCreateBankRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BankRuleInput) =>
      apiClient<{ rule: BankRule }>('/bank-rules', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-rules'] }),
  });
}

function useUpdateBankRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<BankRuleInput> & { id: string }) =>
      apiClient<{ rule: BankRule }>(`/bank-rules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-rules'] }),
  });
}

function useDeleteBankRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<void>(`/bank-rules/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bank-rules'] }),
  });
}

function useSubmitToGlobal() {
  return useMutation({
    mutationFn: ({ ruleId, note }: { ruleId: string; note?: string }) =>
      apiClient(`/bank-rules/${ruleId}/submit-global`, { method: 'POST', body: JSON.stringify({ note }) }),
  });
}

// ─── Blank form state ───────────────────────────────────────────────

const blankForm: BankRuleInput = {
  name: '',
  applyTo: 'both',
  descriptionContains: '',
  amountEquals: '',
  amountMin: '',
  amountMax: '',
  assignAccountId: '',
  assignContactId: '',
  assignMemo: '',
  assignTagId: null,
  autoConfirm: false,
  priority: 10,
  isActive: true,
};

// ─── Page Component ─────────────────────────────────────────────────

export function BankRulesPage() {
  const { data, isLoading, error } = useBankRules();
  const createRule = useCreateBankRule();
  const updateRule = useUpdateBankRule();
  const deleteRule = useDeleteBankRule();
  const submitToGlobal = useSubmitToGlobal();

  const { data: globalRulesData } = useQuery({
    queryKey: ['bank-rules', 'global'],
    queryFn: async () => {
      const res = await apiClient<{ rules: BankRule[] }>('/bank-rules/global/list');
      return res.rules;
    },
  });

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BankRuleInput>({ ...blankForm });
  const [globalSubmitSuccess, setGlobalSubmitSuccess] = useState('');
  const [pendingAction, setPendingAction] = useState<
    | { title: string; message: string; confirmLabel: string; variant?: 'primary' | 'danger'; onConfirm: () => void }
    | null
  >(null);

  useEffect(() => {
    if (!globalSubmitSuccess) return;
    const t = setTimeout(() => setGlobalSubmitSuccess(''), 3000);
    return () => clearTimeout(t);
  }, [globalSubmitSuccess]);

  const rules = data?.data || [];

  const resetForm = () => {
    setForm({ ...blankForm });
    setShowCreate(false);
    setEditingId(null);
  };

  const handleCreate = () => {
    createRule.mutate(
      {
        ...form,
        descriptionContains: form.descriptionContains || null,
        amountEquals: form.amountEquals || null,
        amountMin: form.amountMin || null,
        amountMax: form.amountMax || null,
        assignAccountId: form.assignAccountId || null,
        assignContactId: form.assignContactId || null,
        assignMemo: form.assignMemo || null,
        assignTagId: form.assignTagId,
      },
      { onSuccess: resetForm },
    );
  };

  const handleUpdate = () => {
    if (!editingId) return;
    updateRule.mutate(
      {
        id: editingId,
        ...form,
        descriptionContains: form.descriptionContains || null,
        amountEquals: form.amountEquals || null,
        amountMin: form.amountMin || null,
        amountMax: form.amountMax || null,
        assignAccountId: form.assignAccountId || null,
        assignContactId: form.assignContactId || null,
        assignMemo: form.assignMemo || null,
        assignTagId: form.assignTagId,
      },
      { onSuccess: resetForm },
    );
  };

  const startEdit = (rule: BankRule) => {
    setEditingId(rule.id);
    setShowCreate(false);
    setForm({
      name: rule.name,
      applyTo: rule.applyTo,
      descriptionContains: rule.descriptionContains || '',
      amountEquals: rule.amountEquals || '',
      amountMin: rule.amountMin || '',
      amountMax: rule.amountMax || '',
      assignAccountId: rule.assignAccountId || '',
      assignContactId: rule.assignContactId || '',
      assignMemo: rule.assignMemo || '',
      assignTagId: rule.assignTagId ?? null,
      autoConfirm: rule.autoConfirm,
      priority: rule.priority,
      isActive: rule.isActive,
    });
  };

  const toggleActive = (rule: BankRule) => {
    updateRule.mutate({ id: rule.id, isActive: !rule.isActive });
  };

  // ── Helpers for summary text ────────────────────────────────────

  const conditionsSummary = (rule: BankRule): string => {
    const parts: string[] = [];
    if (rule.descriptionContains) parts.push(`contains "${rule.descriptionContains}"`);
    if (rule.amountEquals) parts.push(`amount = $${rule.amountEquals}`);
    if (rule.amountMin && rule.amountMax) parts.push(`$${rule.amountMin} - $${rule.amountMax}`);
    else if (rule.amountMin) parts.push(`>= $${rule.amountMin}`);
    else if (rule.amountMax) parts.push(`<= $${rule.amountMax}`);
    return parts.length ? parts.join(', ') : '--';
  };

  const actionsSummary = (rule: BankRule): string => {
    const parts: string[] = [];
    if (rule.assignAccountName) parts.push(`Account: ${rule.assignAccountName}`);
    else if (rule.assignAccountId) parts.push('Account assigned');
    if (rule.assignContactName) parts.push(`Contact: ${rule.assignContactName}`);
    else if (rule.assignContactId) parts.push('Contact assigned');
    if (rule.assignMemo) parts.push(`Memo: "${rule.assignMemo}"`);
    if (rule.autoConfirm) parts.push('Auto-confirm');
    return parts.length ? parts.join(', ') : '--';
  };

  // ── Render ──────────────────────────────────────────────────────

  if (isLoading) return <LoadingSpinner className="py-12" />;

  if (error) {
    return (
      <div className="bg-white rounded-lg border p-12 text-center">
        <p className="text-red-600 mb-4">Failed to load bank rules.</p>
        <Button variant="secondary" onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div>
      {globalSubmitSuccess && (
        <div role="status" className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {globalSubmitSuccess}
        </div>
      )}
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bank Rules</h1>
        {!showCreate && !editingId && (
          <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New Rule
          </Button>
        )}
      </div>

      {/* Inline Create / Edit Form */}
      {(showCreate || editingId) && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              {editingId ? 'Edit Rule' : 'New Rule'}
            </h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Apply To</label>
              <div className="flex gap-2">
                {(['deposits', 'expenses', 'both'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setForm({ ...form, applyTo: opt })}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                      form.applyTo === opt
                        ? 'bg-primary-50 border-primary-300 text-primary-700 font-medium'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Conditions */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Conditions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Description Contains"
                value={form.descriptionContains || ''}
                onChange={(e) => setForm({ ...form, descriptionContains: e.target.value })}
                placeholder="e.g. AMAZON"
              />
              <Input
                label="Amount Equals"
                type="number"
                step="0.01"
                value={form.amountEquals || ''}
                onChange={(e) => setForm({ ...form, amountEquals: e.target.value })}
                placeholder="0.00"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Amount Min"
                  type="number"
                  step="0.01"
                  value={form.amountMin || ''}
                  onChange={(e) => setForm({ ...form, amountMin: e.target.value })}
                  placeholder="0.00"
                />
                <Input
                  label="Amount Max"
                  type="number"
                  step="0.01"
                  value={form.amountMax || ''}
                  onChange={(e) => setForm({ ...form, amountMax: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AccountSelector
                label="Assign Account"
                value={form.assignAccountId || ''}
                onChange={(v) => setForm({ ...form, assignAccountId: v })}
              />
              <ContactSelector
                label="Assign Contact"
                value={form.assignContactId || ''}
                onChange={(v) => setForm({ ...form, assignContactId: v })}
              />
              <Input
                label="Assign Memo"
                value={form.assignMemo || ''}
                onChange={(e) => setForm({ ...form, assignMemo: e.target.value })}
                placeholder="Optional memo text"
              />
            </div>
            <div className="mt-4 max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign Tag</label>
              <LineTagPicker
                value={form.assignTagId}
                onChange={(t) => setForm({ ...form, assignTagId: t })}
              />
              <p className="mt-1 text-xs text-gray-500">
                Stamped on every journal line produced when this rule matches.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.autoConfirm}
                onChange={(e) => setForm({ ...form, autoConfirm: e.target.checked })}
                className="rounded"
              />
              Auto-confirm matched transactions
            </label>
            <div className="w-28">
              <Input
                label="Priority"
                type="number"
                min={1}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 10 })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={resetForm}>Cancel</Button>
            {editingId ? (
              <Button onClick={handleUpdate} loading={updateRule.isPending}>Save Changes</Button>
            ) : (
              <Button onClick={handleCreate} loading={createRule.isPending}>Create Rule</Button>
            )}
          </div>
        </div>
      )}

      {/* Rules Table */}
      {rules.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">
          No bank rules yet. Create a rule to automatically categorize imported bank transactions.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Apply To</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Conditions</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Times Applied</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Active</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map((rule) => (
                <tr key={rule.id} className={!rule.isActive ? 'opacity-50' : undefined}>
                  <td className="px-4 py-3 font-medium text-gray-900">{rule.name}</td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{rule.applyTo}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-[200px] truncate">{conditionsSummary(rule)}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs max-w-[250px] truncate">{actionsSummary(rule)}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{rule.timesApplied}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActive(rule)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        rule.isActive ? 'bg-primary-600' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          rule.isActive ? 'translate-x-4' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => startEdit(rule)}
                        className="text-gray-400 hover:text-primary-600 p-1"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() =>
                          setPendingAction({
                            title: 'Submit as global rule?',
                            message: `Submit "${rule.name}" as a global rule suggestion for review.`,
                            confirmLabel: 'Submit',
                            variant: 'primary',
                            onConfirm: () =>
                              submitToGlobal.mutate({ ruleId: rule.id }, {
                                onSuccess: () => setGlobalSubmitSuccess('Rule submitted for global review.'),
                              }),
                          })
                        }
                        className="text-gray-400 hover:text-blue-500 p-1"
                        title="Submit as Global Rule"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() =>
                          setPendingAction({
                            title: 'Delete rule?',
                            message: `This removes "${rule.name}" from your bank rules. This cannot be undone.`,
                            confirmLabel: 'Delete',
                            variant: 'danger',
                            onConfirm: () => deleteRule.mutate(rule.id),
                          })
                        }
                        className="text-gray-400 hover:text-red-500 p-1"
                        title="Delete"
                      >
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
      {/* Global Rules (read-only) */}
      {globalRulesData && globalRulesData.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">Global Rules</h2>
            <span className="text-xs text-gray-400">Applied to all companies as fallback</span>
          </div>
          <div className="bg-white rounded-lg border border-blue-100 shadow-sm overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-blue-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-blue-700 uppercase">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-blue-700 uppercase">Conditions</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-blue-700 uppercase">Category</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-blue-700 uppercase">Contact</th>
                </tr>
              </thead>
              <tbody>
                {globalRulesData.map((rule) => (
                  <tr key={rule.id} className="border-b border-blue-50">
                    <td className="px-4 py-2.5 font-medium text-gray-900">{rule.name}</td>
                    <td className="px-4 py-2.5 text-gray-600 text-xs">
                      {rule.descriptionContains && `Contains: "${rule.descriptionContains}"`}
                      {rule.descriptionExact && `Exact: "${rule.descriptionExact}"`}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{rule.assignAccountName || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{rule.assignContactName || '—'}</td>
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
