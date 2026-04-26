// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import {
  LineChart,
  Plus,
  FileText,
  Palette,
  Wand2,
  Eye,
  RefreshCw,
  Pencil,
  Trash2,
  Copy,
  Download,
} from 'lucide-react';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { useCompanyContext } from '../../../providers/CompanyProvider';
import { ThemeEditor } from './ThemeEditor';
import { FormulaBuilder } from './FormulaBuilder';
import { LayoutEditor } from './LayoutEditor';

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 16 + 17 — bookkeeper UI for
// Report Builder. List templates + instances, create instance, set
// status. The full drag-drop editor + AI summary surfaces are large
// enough to be future iterations on top of this foundation.

interface Template {
  id: string;
  name: string;
  description: string | null;
  defaultPeriod: string;
  isPracticeTemplate: boolean;
}

interface Instance {
  id: string;
  templateId: string | null;
  companyId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  publishedAt: string | null;
  version: number;
  pdfUrl: string | null;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${token ?? ''}`,
  };
  // Only set Content-Type when there's a body — keeps GET/DELETE clean
  // and lets the server distinguish "no body" from "empty JSON body."
  if (init?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`/api/v1${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) detail = body.error.message;
    } catch {
      // non-JSON response — fall back to status code
    }
    throw new Error(detail);
  }
  return res.json();
}

export function ReportBuilderPage() {
  const { companies, activeCompanyId } = useCompanyContext();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [instances, setInstances] = useState<Instance[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [showFormula, setShowFormula] = useState(false);
  const [editingLayoutTemplateId, setEditingLayoutTemplateId] = useState<string | null>(null);
  const [previewInstanceId, setPreviewInstanceId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editingInstance, setEditingInstance] = useState<Instance | null>(null);

  const reload = async () => {
    try {
      const [t, i] = await Promise.all([
        api<{ templates: Template[] }>('/practice/reports/templates'),
        api<{ instances: Instance[] }>('/practice/reports/instances'),
      ]);
      setTemplates(t.templates);
      setInstances(i.instances);
    } catch {
      setError('Failed to load reports.');
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const importStock = async () => {
    try {
      await api('/practice/reports/templates/import-stock', { method: 'POST' });
      await reload();
    } catch {
      setError('Stock import failed.');
    }
  };

  const setStatus = async (id: string, status: string) => {
    setError(null);
    try {
      const result = await api<{
        ok: true;
        pdfRendered?: boolean;
        pdfError?: string | null;
        version?: number;
      }>(`/practice/reports/instances/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      });
      if (status === 'published' && result.pdfRendered === false && result.pdfError) {
        setError(`Published, but PDF render failed: ${result.pdfError}`);
      }
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Status update failed.');
    }
  };

  const duplicateInstance = async (i: Instance) => {
    setError(null);
    try {
      await api<{ id: string; version: number }>(
        `/practice/reports/instances/${i.id}/duplicate`,
        { method: 'POST' },
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Duplicate failed.');
    }
  };

  const downloadPdf = async (i: Instance) => {
    if (!i.pdfUrl) {
      setError('No PDF on file. Re-publish to generate one.');
      return;
    }
    const token = localStorage.getItem('accessToken');
    const res = await fetch(`/api/v1/practice/reports/instances/${i.id}/download`, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    });
    if (!res.ok) {
      setError(`Download failed (${res.status}).`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-v${i.version}-${i.periodEnd}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteTemplate = async (t: Template) => {
    if (!confirm(`Delete template "${t.name}"? Instances created from it stay (untemplated).`)) return;
    try {
      await api(`/practice/reports/templates/${t.id}`, { method: 'DELETE' });
      await reload();
    } catch {
      setError('Template delete failed.');
    }
  };

  const deleteInstance = async (i: Instance) => {
    const force = i.status === 'published';
    const confirmText = force
      ? `This report has been published. Deleting it removes the artifact and the snapshot — clients will lose access. Type DELETE to confirm.`
      : `Delete this report? This cannot be undone.`;
    if (force) {
      const ans = prompt(confirmText);
      if (ans !== 'DELETE') return;
    } else if (!confirm(confirmText)) return;
    try {
      await api(`/practice/reports/instances/${i.id}${force ? '?force=true' : ''}`, {
        method: 'DELETE',
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Instance delete failed.');
    }
  };

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Report Builder</h1>
          <p className="text-sm text-gray-600 mt-1">
            Compose KPIs, charts, and AI summaries into client-ready advisory packets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFormula(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-100 px-3 py-2 rounded-md"
          >
            <Wand2 className="h-4 w-4" /> Formulas
          </button>
          <button
            onClick={() => setShowTheme(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-100 px-3 py-2 rounded-md"
          >
            <Palette className="h-4 w-4" /> Theme
          </button>
          <button
            onClick={() => setShowAdd(true)}
            disabled={!activeCompanyId || (templates?.length ?? 0) === 0}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md"
          >
            <Plus className="h-4 w-4" /> New report
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-3 p-3 border border-red-200 bg-red-50 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      <h2 className="text-base font-semibold text-gray-900 mb-2">Templates</h2>
      {!templates ? (
        <div className="py-6 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg mb-6">
          <LineChart className="mx-auto h-10 w-10 text-gray-400 mb-3" />
          <p className="text-sm text-gray-500 mb-3">No templates yet.</p>
          <button
            onClick={importStock}
            className="text-sm font-medium text-indigo-700 hover:underline"
          >
            Import 3 stock templates
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {templates.map((t) => (
            <div
              key={t.id}
              className="group border border-gray-200 rounded-lg p-4 bg-white relative"
            >
              <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  title="Edit name & period"
                  onClick={() => setEditingTemplate(t)}
                  className="p-1 text-gray-500 hover:bg-gray-100 rounded"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  title="Delete template"
                  onClick={() => deleteTemplate(t)}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-sm font-semibold text-gray-900 pr-12">{t.name}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-3">{t.description ?? '—'}</p>
              <p className="text-xs text-gray-400 mt-2">Period default: {t.defaultPeriod}</p>
              <button
                onClick={() => setEditingLayoutTemplateId(t.id)}
                className="mt-2 text-xs font-medium text-indigo-700 hover:underline"
              >
                Edit layout →
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-base font-semibold text-gray-900 mb-2">Instances</h2>
      {!instances ? null : instances.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-gray-300 rounded-lg">
          <FileText className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">No reports generated yet.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Period</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Company</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Status</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Version</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {instances.map((i) => {
                const co = companies.find((c) => c.id === i.companyId);
                return (
                  <tr key={i.id}>
                    <td className="px-4 py-3 text-gray-900">
                      {i.periodStart} → {i.periodEnd}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{co?.businessName ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{i.status}</td>
                    <td className="px-4 py-3 text-gray-700">{i.version}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setPreviewInstanceId(i.id)}
                        title="Preview"
                        className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:underline mr-2"
                      >
                        <Eye className="h-3.5 w-3.5" /> Preview
                      </button>
                      {i.status === 'published' ? (
                        <>
                          {i.pdfUrl && (
                            <button
                              onClick={() => downloadPdf(i)}
                              title="Download PDF"
                              className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:underline mr-2"
                            >
                              <Download className="h-3.5 w-3.5" /> PDF
                            </button>
                          )}
                          <button
                            onClick={() => duplicateInstance(i)}
                            title="Duplicate as new draft (v+1)"
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline mr-2"
                          >
                            <Copy className="h-3.5 w-3.5" /> Duplicate
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditingInstance(i)}
                            title="Edit period & template"
                            className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:underline mr-2"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => setStatus(i.id, 'published')}
                            className="text-xs font-medium text-indigo-700 hover:underline mr-2"
                          >
                            Publish
                          </button>
                        </>
                      )}
                      {i.status !== 'archived' && i.status !== 'published' && (
                        <button
                          onClick={() => setStatus(i.id, 'archived')}
                          className="text-xs font-medium text-gray-600 hover:underline mr-2"
                        >
                          Archive
                        </button>
                      )}
                      {i.status === 'archived' && (
                        <button
                          onClick={() => setStatus(i.id, 'draft')}
                          title="Reopen as draft"
                          className="text-xs font-medium text-gray-600 hover:underline mr-2"
                        >
                          Reopen
                        </button>
                      )}
                      <button
                        onClick={() => deleteInstance(i)}
                        title="Delete"
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showTheme && <ThemeEditor onClose={() => setShowTheme(false)} />}
      {showFormula && <FormulaBuilder onClose={() => setShowFormula(false)} />}
      {previewInstanceId && (
        <ReportPreviewModal
          instanceId={previewInstanceId}
          onClose={() => setPreviewInstanceId(null)}
          onPublished={() => {
            setPreviewInstanceId(null);
            reload();
          }}
        />
      )}
      {editingTemplate && (
        <EditTemplateModal
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSaved={() => {
            setEditingTemplate(null);
            reload();
          }}
        />
      )}
      {editingInstance && (
        <EditInstanceModal
          instance={editingInstance}
          templates={templates ?? []}
          onClose={() => setEditingInstance(null)}
          onSaved={() => {
            setEditingInstance(null);
            reload();
          }}
        />
      )}
      {editingLayoutTemplateId && (
        <LayoutEditor
          templateId={editingLayoutTemplateId}
          onClose={() => setEditingLayoutTemplateId(null)}
          onSaved={() => {
            setEditingLayoutTemplateId(null);
            reload();
          }}
        />
      )}

      {showAdd && templates && templates.length > 0 && (
        <NewInstanceModal
          templates={templates}
          companyId={activeCompanyId}
          companies={companies}
          onClose={() => setShowAdd(false)}
          onCreated={reload}
        />
      )}
    </div>
  );
}

function NewInstanceModal({
  templates,
  companyId,
  companies,
  onClose,
  onCreated,
}: {
  templates: Template[];
  companyId: string | null;
  companies: { id: string; businessName: string }[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [templateId, setTemplateId] = useState<string>(templates[0]?.id ?? '');
  const [coId, setCoId] = useState<string>(companyId ?? companies[0]?.id ?? '');
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [periodStart, setPeriodStart] = useState(monthStart);
  const [periodEnd, setPeriodEnd] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api('/practice/reports/instances', {
        method: 'POST',
        body: JSON.stringify({
          templateId,
          companyId: coId,
          periodStart,
          periodEnd,
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900">New report instance</h2>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm">
            <span className="block text-gray-800 mb-1">Template</span>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="block text-gray-800 mb-1">Company</span>
            <select
              value={coId}
              onChange={(e) => setCoId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.businessName}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="block text-gray-800 mb-1">Period start</span>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="block text-gray-800 mb-1">Period end</span>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </label>
          </div>
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md"
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit template (name + description + default period) ────────

function EditTemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: Template;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description ?? '');
  const [defaultPeriod, setDefaultPeriod] = useState(template.defaultPeriod);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      await api(`/practice/reports/templates/${template.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          defaultPeriod,
        }),
      });
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Save failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SmallModal title="Edit template" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm">
          <span className="block text-gray-800 mb-1">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="block text-gray-800 mb-1">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="block text-gray-800 mb-1">Default period</span>
          <select
            value={defaultPeriod}
            onChange={(e) => setDefaultPeriod(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="this_quarter">This quarter</option>
            <option value="last_quarter">Last quarter</option>
            <option value="ytd">Year-to-date</option>
            <option value="last_year">Last year</option>
          </select>
        </label>
        {err && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {err}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </SmallModal>
  );
}

// ── Edit instance (period dates + template) ────────────────────

function EditInstanceModal({
  instance,
  templates,
  onClose,
  onSaved,
}: {
  instance: Instance;
  templates: Template[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [periodStart, setPeriodStart] = useState(instance.periodStart);
  const [periodEnd, setPeriodEnd] = useState(instance.periodEnd);
  const [templateId, setTemplateId] = useState<string>(instance.templateId ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      await api(`/practice/reports/instances/${instance.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          periodStart,
          periodEnd,
          // If templateId differs, re-snapshot the layout server-side.
          ...(templateId !== (instance.templateId ?? '')
            ? { templateId: templateId || null }
            : {}),
        }),
      });
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Save failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SmallModal title="Edit report" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="block text-gray-800 mb-1">Period start</span>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="block text-gray-800 mb-1">Period end</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </label>
        </div>
        <label className="block text-sm">
          <span className="block text-gray-800 mb-1">Template</span>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">— No template (custom layout) —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {templateId !== (instance.templateId ?? '') && (
            <p className="mt-1 text-[11px] text-amber-700">
              Switching templates re-snapshots the layout. Any layout edits already saved on this
              instance will be replaced by the new template's layout.
            </p>
          )}
        </label>
        {err && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {err}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md"
          >
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </SmallModal>
  );
}

function SmallModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-sm">
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

// ── Preview modal ────────────────────────────────────────────────

interface InstanceDetail {
  id: string;
  templateId: string | null;
  companyId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  publishedAt: string | null;
  pdfUrl: string | null;
  layoutSnapshotJsonb: unknown[];
  dataSnapshotJsonb: Record<string, unknown> | null;
  version: number;
}

function ReportPreviewModal({
  instanceId,
  onClose,
  onPublished,
}: {
  instanceId: string;
  onClose: () => void;
  onPublished: () => void;
}) {
  const { companies } = useCompanyContext();
  const [instance, setInstance] = useState<InstanceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const reload = async () => {
    setError(null);
    try {
      const data = await api<{ instance: InstanceDetail }>(`/practice/reports/instances/${instanceId}`);
      setInstance(data.instance);
    } catch {
      setError('Failed to load instance.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  const compute = async () => {
    setComputing(true);
    setError(null);
    try {
      const result = await api<{
        keys: string[];
        metricsAvailable: boolean;
        error: string | null;
      }>(`/practice/reports/instances/${instanceId}/compute`, { method: 'POST' });
      await reload();
      if (!result.metricsAvailable && result.error) {
        setError(`Computed with placeholders — backend error: ${result.error}`);
      } else if (result.keys.length === 0) {
        setError('Layout has no KPI rows yet — add a KPI row in the layout editor.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Compute failed.');
    } finally {
      setComputing(false);
    }
  };

  const publish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const result = await api<{
        ok: true;
        pdfRendered: boolean;
        pdfError: string | null;
      }>(`/practice/reports/instances/${instanceId}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: 'published' }),
      });
      if (!result.pdfRendered && result.pdfError) {
        setError(`Published, but PDF render failed: ${result.pdfError}`);
        setPublishing(false);
        await reload();
        return;
      }
      onPublished();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed.');
      setPublishing(false);
    }
  };

  const patch = async (body: {
    kpiOverrides?: Record<string, string>;
    aiSummary?: string;
    textOverrides?: Record<string, string>;
  }) => {
    try {
      const result = await api<{ data: Record<string, unknown> }>(
        `/practice/reports/instances/${instanceId}/data`,
        { method: 'PATCH', body: JSON.stringify(body) },
      );
      // Merge response back into local state without a full reload
      // so the edited cell flips back to read-mode immediately.
      setInstance((prev) =>
        prev ? { ...prev, dataSnapshotJsonb: result.data as Record<string, unknown> } : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    }
  };

  const company = instance ? companies.find((c) => c.id === instance.companyId) : null;
  const layout = instance?.layoutSnapshotJsonb ?? [];
  const data = instance?.dataSnapshotJsonb ?? {};
  const hasData =
    instance != null &&
    instance.dataSnapshotJsonb != null &&
    Object.keys(instance.dataSnapshotJsonb).length > 0;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Preview</p>
            <h2 className="text-base font-semibold text-gray-900">
              {company?.businessName ?? '—'} ·{' '}
              {instance ? `${instance.periodStart} → ${instance.periodEnd}` : ''}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {instance && instance.status !== 'published' && (
              <button
                onClick={compute}
                disabled={computing || !instance}
                className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:bg-gray-100 px-2 py-1 rounded-md disabled:opacity-50"
                title="Re-pull KPIs and block data from the books"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${computing ? 'animate-spin' : ''}`} />
                {computing ? 'Computing…' : hasData ? 'Recompute' : 'Compute'}
              </button>
            )}
            {instance && instance.status === 'published' && (
              <span className="text-[11px] text-gray-500 px-2 py-1 rounded bg-gray-100">
                v{instance.version} · published — read only
              </span>
            )}
            {instance && instance.status !== 'published' && (
              <button
                onClick={publish}
                disabled={publishing}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md"
              >
                {publishing ? 'Publishing…' : 'Publish'}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-sm px-2"
            >
              ×
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {loading || !instance ? (
            <p className="text-sm text-gray-500 py-12 text-center">Loading…</p>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : (
            <article className="bg-white border border-gray-200 rounded-lg p-6 max-w-2xl mx-auto">
              <header className="mb-4 pb-3 border-b border-gray-100">
                <h1 className="text-xl font-semibold text-gray-900">
                  {company?.businessName ?? '—'}
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  {instance.periodStart} → {instance.periodEnd} · v{instance.version} · {instance.status}
                </p>
              </header>

              {!hasData && (
                <div className="mb-4 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-900">
                  No data computed yet. Click <strong>Compute sample data</strong> to fill the layout
                  with placeholders so you can see the structure.
                </div>
              )}

              {layout.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No layout blocks. Open this template's layout editor to add some.
                </p>
              ) : (
                <ReportRender
                  layout={layout}
                  data={data as Record<string, unknown>}
                  editable={instance.status !== 'published'}
                  onPatch={patch}
                />
              )}
            </article>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportRender({
  layout,
  data,
  editable,
  onPatch,
}: {
  layout: unknown[];
  data: Record<string, unknown>;
  editable?: boolean;
  onPatch?: (patch: {
    kpiOverrides?: Record<string, string>;
    aiSummary?: string;
    textOverrides?: Record<string, string>;
  }) => Promise<void>;
}) {
  const kpiValues = (data['kpis'] as Record<string, unknown>) ?? {};
  const kpiNames = (data['kpi_names'] as Record<string, string>) ?? {};
  const aiSummary = (data['ai_summary'] as string) ?? '';
  const textOverrides = (data['text_overrides'] as Record<string, string>) ?? {};
  const blocks = (data['blocks'] as Record<string, BlockPayload>) ?? {};

  return (
    <div className="space-y-4">
      {layout.map((blockRaw, i) => {
        const block = blockRaw as Record<string, unknown>;
        const t = block['type'] as string;
        // Stable key: use the saved block id when present so React doesn't
        // tear down editable cells on reorder.
        const blockId = (block['id'] as string | undefined) ?? `idx-${i}`;
        if (t === 'kpi-row') {
          const keys = (block['kpis'] as string[]) ?? [];
          if (keys.length === 0) {
            return (
              <div key={blockId} className="text-xs text-gray-500 italic">
                Empty KPI row — pick KPIs in the layout editor.
              </div>
            );
          }
          return (
            <div key={blockId} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {keys.map((k) => (
                <KpiCard
                  key={k}
                  label={kpiNames[k] ?? k.replace(/_/g, ' ')}
                  value={kpiValues[k] !== undefined ? String(kpiValues[k]) : '—'}
                  editable={editable}
                  onSave={onPatch ? (v) => onPatch({ kpiOverrides: { [k]: v } }) : undefined}
                />
              ))}
            </div>
          );
        }
        if (t === 'ai_summary') {
          return (
            <EditableTextSection
              key={blockId}
              label="AI summary"
              value={aiSummary}
              empty="No summary saved yet — click to write one."
              editable={editable}
              onSave={onPatch ? (v) => onPatch({ aiSummary: v }) : undefined}
            />
          );
        }
        if (t === 'text') {
          const original = (block['placeholder'] as string) ?? '';
          // Override key uses the stable block id when present, with a
          // legacy fallback to array index for layouts saved before
          // block ids were persisted.
          const overrideKey = (block['id'] as string | undefined) ?? String(i);
          const legacyOverride = textOverrides[String(i)];
          const stableOverride = textOverrides[overrideKey];
          const override = stableOverride ?? legacyOverride;
          const value = override ?? original;
          return (
            <EditableTextSection
              key={blockId}
              label="Notes"
              value={value}
              empty="(empty)"
              compact
              editable={editable}
              onSave={
                onPatch
                  ? (v) => onPatch({ textOverrides: { [overrideKey]: v } })
                  : undefined
              }
            />
          );
        }
        if (t === 'chart' || t === 'block' || t === 'report') {
          const payloadKey =
            (block['id'] as string | undefined) ??
            (block['name'] as string | undefined) ??
            (block['report'] as string | undefined) ??
            (block['key'] as string | undefined) ??
            'unknown';
          const payload = blocks[payloadKey];
          return (
            <BlockRender
              key={blockId}
              block={block}
              payload={payload}
            />
          );
        }
        if (t === 'tag-segment') {
          const tags = (block['tags'] as string[]) ?? [];
          return (
            <div key={blockId} className="border-l-4 border-purple-200 pl-3 py-1 text-sm text-gray-700">
              <span className="text-xs uppercase tracking-wide text-gray-500">Tag segment</span>{' '}
              · {tags.length} tag{tags.length === 1 ? '' : 's'}
            </div>
          );
        }
        if (t === 'image') {
          const src = (block['src'] as string) ?? '';
          return src ? (
            <img key={blockId} src={src} alt="" className="max-w-full rounded" />
          ) : (
            <div key={blockId} className="text-xs text-gray-500 italic">[image — no src]</div>
          );
        }
        if (t === 'page-break') {
          return (
            <div key={blockId} className="border-t-2 border-dashed border-gray-300 my-3 text-center">
              <span className="bg-white text-[10px] uppercase tracking-wide text-gray-400 px-2 -mt-2 inline-block">
                page break
              </span>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

// ── Block rendering ─────────────────────────────────────────────

interface BlockPayload {
  type: string;
  data?: unknown;
  error?: string;
}

interface AgingBuckets {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  over90: number;
  total: number;
}
interface PlSummary {
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpense: number;
  netIncome: number;
}
interface BsSummary { assets: number; liabilities: number; equity: number }
interface PlVsPriorYear { current: PlSummary; prior: PlSummary | null }
interface TopRow { name: string; amount: number }

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function BlockRender({
  block,
  payload,
}: {
  block: Record<string, unknown>;
  payload: BlockPayload | undefined;
}) {
  const blockType = String(block['type'] ?? '');
  const name =
    (block['name'] as string | undefined) ??
    (block['report'] as string | undefined) ??
    (block['key'] as string | undefined) ??
    '';
  const friendly = name.replace(/_/g, ' ');

  if (!payload) {
    return (
      <Frame label={blockType} title={friendly}>
        <p className="text-xs text-gray-500 italic">Run Recompute to populate this block.</p>
      </Frame>
    );
  }
  if (payload.error) {
    return (
      <Frame label={blockType} title={friendly} accent="amber">
        <p className="text-xs text-amber-800">{payload.error}</p>
      </Frame>
    );
  }
  switch (payload.type) {
    case 'top_customers':
    case 'top_vendors': {
      const rows = (payload.data as TopRow[]) ?? [];
      const heading = payload.type === 'top_customers' ? 'Top Customers' : 'Top Vendors';
      return (
        <Frame label="Top" title={heading}>
          {rows.length === 0 ? (
            <p className="text-xs text-gray-500 italic">No activity in this period.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-b border-gray-100 last:border-0">
                    <td className="py-1 pr-2 text-gray-800">{r.name}</td>
                    <td className="py-1 text-right text-gray-900 font-medium">{fmtMoney(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Frame>
      );
    }
    case 'ar_aging':
    case 'ap_aging': {
      const b = (payload.data as AgingBuckets) ?? null;
      const heading = payload.type === 'ar_aging' ? 'A/R Aging' : 'A/P Aging';
      return (
        <Frame label="Aging" title={heading}>
          {!b || b.total === 0 ? (
            <p className="text-xs text-gray-500 italic">Nothing outstanding.</p>
          ) : (
            <div className="grid grid-cols-5 gap-2 text-xs">
              <AgingCell label="Current" v={b.current} />
              <AgingCell label="1–30" v={b.days1to30} />
              <AgingCell label="31–60" v={b.days31to60} />
              <AgingCell label="61–90" v={b.days61to90} />
              <AgingCell label="90+" v={b.over90} />
              <div className="col-span-5 text-right text-gray-700 mt-1">
                Total <strong>{fmtMoney(b.total)}</strong>
              </div>
            </div>
          )}
        </Frame>
      );
    }
    case 'pl_bar': {
      const p = (payload.data as PlSummary) ?? null;
      return (
        <Frame label="Chart" title="Profit & Loss">
          {!p ? <p className="text-xs text-gray-500 italic">No data.</p> : <PlBarChart p={p} />}
        </Frame>
      );
    }
    case 'profit_loss': {
      const p = (payload.data as PlSummary) ?? null;
      return (
        <Frame title="Profit & Loss">
          {!p ? <p className="text-xs text-gray-500 italic">No data.</p> : <PlTable p={p} />}
        </Frame>
      );
    }
    case 'balance_sheet': {
      const b = (payload.data as BsSummary) ?? null;
      return (
        <Frame title="Balance Sheet">
          {!b ? (
            <p className="text-xs text-gray-500 italic">No data.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                <tr><td className="py-1 text-gray-700">Total Assets</td><td className="py-1 text-right font-medium">{fmtMoney(b.assets)}</td></tr>
                <tr><td className="py-1 text-gray-700">Total Liabilities</td><td className="py-1 text-right font-medium">{fmtMoney(b.liabilities)}</td></tr>
                <tr><td className="py-1 text-gray-700">Total Equity</td><td className="py-1 text-right font-medium">{fmtMoney(b.equity)}</td></tr>
              </tbody>
            </table>
          )}
        </Frame>
      );
    }
    case 'pl_vs_prior_year': {
      const d = (payload.data as PlVsPriorYear) ?? null;
      return (
        <Frame label="Chart" title="P&L vs. Prior Year">
          {!d ? (
            <p className="text-xs text-gray-500 italic">No data.</p>
          ) : (
            <PlVsPriorChart d={d} />
          )}
        </Frame>
      );
    }
    default:
      return (
        <Frame label={blockType} title={friendly}>
          <p className="text-xs text-gray-500 italic">
            Block type "{payload.type}" — preview not yet wired.
          </p>
        </Frame>
      );
  }
}

function Frame({
  label,
  title,
  accent,
  children,
}: {
  label?: string;
  title: string;
  accent?: 'amber';
  children: React.ReactNode;
}) {
  const border = accent === 'amber' ? 'border-amber-300' : 'border-gray-200';
  return (
    <section className={`bg-white border ${border} rounded-md p-3`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-2">
        {label ? `${label} · ${title}` : title}
      </p>
      {children}
    </section>
  );
}

function AgingCell({ label, v }: { label: string; v: number }) {
  return (
    <div className="border border-gray-200 rounded p-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-gray-900">{fmtMoney(v)}</p>
    </div>
  );
}

function PlBarChart({ p }: { p: PlSummary }) {
  // 5-bar P&L summary chart. Negative bars (e.g. net loss) render in
  // red so a glance tells the bookkeeper which lines are healthy.
  const data = [
    { name: 'Revenue', amount: p.revenue },
    { name: 'COGS', amount: p.cogs },
    { name: 'Gross Profit', amount: p.grossProfit },
    { name: 'Op. Expense', amount: p.operatingExpense },
    { name: 'Net Income', amount: p.netIncome },
  ];
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: unknown) => fmtMoney(Number(v))}
            width={70}
          />
          <Tooltip formatter={((v: unknown) => fmtMoney(Number(v))) as never} />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.amount < 0 ? '#dc2626' : '#4f46e5'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PlVsPriorChart({ d }: { d: PlVsPriorYear }) {
  // Side-by-side current vs prior bars across the 5 P&L lines.
  const data = [
    {
      name: 'Revenue',
      Current: d.current.revenue,
      'Prior YR': d.prior?.revenue ?? 0,
    },
    {
      name: 'COGS',
      Current: d.current.cogs,
      'Prior YR': d.prior?.cogs ?? 0,
    },
    {
      name: 'Gross Profit',
      Current: d.current.grossProfit,
      'Prior YR': d.prior?.grossProfit ?? 0,
    },
    {
      name: 'Op. Expense',
      Current: d.current.operatingExpense,
      'Prior YR': d.prior?.operatingExpense ?? 0,
    },
    {
      name: 'Net Income',
      Current: d.current.netIncome,
      'Prior YR': d.prior?.netIncome ?? 0,
    },
  ];
  return (
    <div>
      <div style={{ width: '100%', height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: unknown) => fmtMoney(Number(v))}
              width={70}
            />
            <Tooltip formatter={((v: unknown) => fmtMoney(Number(v))) as never} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Current" fill="#4f46e5" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Prior YR" fill="#9ca3af" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!d.prior && (
        <p className="mt-1 text-[11px] text-amber-700">
          No prior-year data on file — Prior YR bars show 0.
        </p>
      )}
    </div>
  );
}

function PlTable({ p }: { p: PlSummary }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        <tr><td className="py-1 text-gray-700">Revenue</td><td className="py-1 text-right font-medium">{fmtMoney(p.revenue)}</td></tr>
        <tr><td className="py-1 text-gray-700">COGS</td><td className="py-1 text-right">{fmtMoney(p.cogs)}</td></tr>
        <tr><td className="py-1 text-gray-700">Gross Profit</td><td className="py-1 text-right font-medium">{fmtMoney(p.grossProfit)}</td></tr>
        <tr><td className="py-1 text-gray-700">Operating Expense</td><td className="py-1 text-right">{fmtMoney(p.operatingExpense)}</td></tr>
        <tr className="border-t border-gray-200"><td className="py-1 text-gray-900 font-semibold">Net Income</td><td className="py-1 text-right font-bold">{fmtMoney(p.netIncome)}</td></tr>
      </tbody>
    </table>
  );
}

// ── Editable cells ──────────────────────────────────────────────

function KpiCard({
  label,
  value,
  editable,
  onSave,
}: {
  label: string;
  value: string;
  editable?: boolean;
  onSave?: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const enter = () => {
    if (!editable || !onSave) return;
    setDraft(value);
    setEditing(true);
  };
  const commit = async () => {
    if (!onSave) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  return (
    <div
      className={`rounded border border-gray-200 p-2 group relative ${
        editable && onSave ? 'cursor-pointer hover:border-indigo-300' : ''
      }`}
      onClick={editing ? undefined : enter}
    >
      <p className="text-[10px] uppercase tracking-wide text-gray-500">
        {label.replace(/_/g, ' ')}
      </p>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setEditing(false);
              setDraft(value);
            }
          }}
          className="mt-0.5 w-full text-base font-semibold text-gray-900 bg-white border border-indigo-300 rounded px-1 outline-none"
        />
      ) : (
        <p className="mt-0.5 text-base font-semibold text-gray-900">
          {saving ? '…' : value}
        </p>
      )}
      {editable && onSave && !editing && (
        <span className="absolute top-1 right-1 text-[9px] text-gray-400 opacity-0 group-hover:opacity-100">
          edit
        </span>
      )}
    </div>
  );
}

function EditableTextSection({
  label,
  value,
  empty,
  compact,
  editable,
  onSave,
}: {
  label: string;
  value: string;
  empty: string;
  compact?: boolean;
  editable?: boolean;
  onSave?: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const enter = () => {
    if (!editable || !onSave) return;
    setDraft(value);
    setEditing(true);
  };
  const commit = async () => {
    if (!onSave) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <section
        className={`border border-indigo-300 rounded-md p-3 ${compact ? '' : 'bg-gray-50'}`}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
          {label}
        </p>
        <textarea
          autoFocus
          rows={compact ? 3 : 6}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <div className="mt-2 flex justify-end gap-2">
          <button
            onClick={() => {
              setEditing(false);
              setDraft(value);
            }}
            className="text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded"
          >
            Cancel
          </button>
          <button
            onClick={commit}
            disabled={saving}
            className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-2 py-1 rounded"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`border border-gray-200 rounded-md p-3 group relative ${
        compact ? '' : 'bg-gray-50'
      } ${editable && onSave ? 'cursor-pointer hover:border-indigo-300' : ''}`}
      onClick={enter}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
        {label}
      </p>
      <p className="text-sm text-gray-800 whitespace-pre-wrap">
        {value || <em className="text-gray-500">{empty}</em>}
      </p>
      {editable && onSave && (
        <span className="absolute top-2 right-2 text-[10px] text-gray-400 opacity-0 group-hover:opacity-100">
          click to edit
        </span>
      )}
    </section>
  );
}

export default ReportBuilderPage;
