// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useRef, useState } from 'react';
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
  AlignJustify,
  Sparkles,
  Archive,
} from 'lucide-react';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { apiClient, API_BASE, getAccessToken } from '../../../api/client';
import { useCompanyContext } from '../../../providers/CompanyProvider';
import { ThemeEditor } from './ThemeEditor';
import { FormulaBuilder } from './FormulaBuilder';
import { LayoutEditor } from './LayoutEditor';
import { DEFAULT_PERIOD_OPTIONS, resolveDefaultPeriodRange } from './period-defaults';

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

// Route all this page's JSON calls through the shared api client so they
// get credentials, the active-company header, and 401 -> refresh -> retry.
// `apiClient` takes a path relative to /api/v1 and throws an `ApiError`
// (which extends Error) on non-2xx, so the `e instanceof Error` checks
// below continue to surface the server's message.
const api = apiClient;

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
  // Row-level in-flight guard: while an instance action (publish /
  // duplicate / archive / delete / download) is running, that row's
  // action buttons are disabled and re-entry is a no-op.
  const [busyId, setBusyId] = useState<string | null>(null);
  // Initial-load failure state (distinct from per-action errors) so the
  // page can render a Retry instead of spinning forever.
  const [loadFailed, setLoadFailed] = useState(false);

  const reload = async () => {
    try {
      const [t, i] = await Promise.all([
        api<{ templates: Template[] }>('/practice/reports/templates'),
        api<{ instances: Instance[] }>('/practice/reports/instances'),
      ]);
      setTemplates(t.templates);
      setInstances(i.instances);
      setLoadFailed(false);
    } catch {
      setError('Failed to load reports.');
      setLoadFailed(true);
    }
  };

  const retryLoad = () => {
    setError(null);
    setLoadFailed(false);
    reload();
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
    if (busyId) return;
    setBusyId(id);
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
    } finally {
      setBusyId(null);
    }
  };

  const duplicateInstance = async (i: Instance) => {
    if (busyId) return;
    setBusyId(i.id);
    setError(null);
    try {
      await api<{ id: string; version: number }>(
        `/practice/reports/instances/${i.id}/duplicate`,
        { method: 'POST' },
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Duplicate failed.');
    } finally {
      setBusyId(null);
    }
  };

  const downloadPdf = async (i: Instance) => {
    if (busyId) return;
    if (!i.pdfUrl) {
      setError('No PDF on file. Re-publish to generate one.');
      return;
    }
    setBusyId(i.id);
    try {
      // Binary download — can't go through apiClient (it parses JSON), but we
      // still build the URL off API_BASE and send credentials so it works in
      // subpath installs and behind the auth cookie.
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/practice/reports/instances/${i.id}/download`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed.');
    } finally {
      setBusyId(null);
    }
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
    if (busyId) return;
    const force = i.status === 'published';
    const confirmText = force
      ? `This report has been published. Deleting it removes the artifact and the snapshot — clients will lose access. Type DELETE to confirm.`
      : `Delete this report? This cannot be undone.`;
    if (force) {
      const ans = prompt(confirmText);
      if (ans !== 'DELETE') return;
    } else if (!confirm(confirmText)) return;
    setBusyId(i.id);
    try {
      await api(`/practice/reports/instances/${i.id}${force ? '?force=true' : ''}`, {
        method: 'DELETE',
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Instance delete failed.');
    } finally {
      setBusyId(null);
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
        loadFailed ? (
          <div className="text-center py-10 border border-dashed border-gray-300 rounded-lg mb-6">
            <p className="text-sm text-gray-600 mb-2">Templates could not be loaded.</p>
            <button
              onClick={retryLoad}
              className="text-sm font-medium text-indigo-700 hover:underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="py-6 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        )
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
      {!instances ? (
        loadFailed ? (
          <div className="text-center py-10 border border-dashed border-gray-300 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">Reports could not be loaded.</p>
            <button
              onClick={retryLoad}
              className="text-sm font-medium text-indigo-700 hover:underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="py-6 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        )
      ) : instances.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-gray-300 rounded-lg">
          <FileText className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">No reports generated yet.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
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
                const busy = busyId === i.id;
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
                              disabled={busy}
                              title="Download PDF"
                              className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:underline mr-2 disabled:opacity-50"
                            >
                              <Download className="h-3.5 w-3.5" /> PDF
                            </button>
                          )}
                          <button
                            onClick={() => duplicateInstance(i)}
                            disabled={busy}
                            title="Duplicate as new draft (v+1)"
                            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:underline mr-2 disabled:opacity-50"
                          >
                            <Copy className="h-3.5 w-3.5" /> Duplicate
                          </button>
                          {/* Published → archived is the only valid archive
                              transition; a published report can't be deleted,
                              only archived (then duplicated for a new version). */}
                          <button
                            onClick={() => setStatus(i.id, 'archived')}
                            disabled={busy}
                            title="Archive this published report"
                            className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:underline mr-2 disabled:opacity-50"
                          >
                            <Archive className="h-3.5 w-3.5" /> Archive
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
                            disabled={busy}
                            className="text-xs font-medium text-indigo-700 hover:underline mr-2 disabled:opacity-50"
                          >
                            {busy ? 'Working…' : 'Publish'}
                          </button>
                        </>
                      )}
                      {/* From archived the only valid move is republish
                          (→ published, bumps version) — the server rejects
                          archived → draft. */}
                      {i.status === 'archived' && (
                        <button
                          onClick={() => setStatus(i.id, 'published')}
                          disabled={busy}
                          title="Republish (new version)"
                          className="text-xs font-medium text-indigo-700 hover:underline mr-2 disabled:opacity-50"
                        >
                          Republish
                        </button>
                      )}
                      {/* Published reports can't be deleted (server enforces
                          PUBLISHED_LOCKED) — archive them instead. */}
                      {i.status !== 'published' && (
                        <button
                          onClick={() => deleteInstance(i)}
                          disabled={busy}
                          title="Delete"
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
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
          onClose={() => {
            setPreviewInstanceId(null);
            // The modal can mutate the instance (compute, inline edits,
            // publish-with-pdf-error) without going through onPublished —
            // always refresh the lists on close so the table never shows
            // a stale status. Two GETs, cheap.
            reload();
          }}
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
  // F6 — the period defaults come from the selected template's
  // defaultPeriod (this_month/last_month/…/last_12_months) instead of
  // always month-start → today.
  const initialRange = resolveDefaultPeriodRange(templates[0]?.defaultPeriod ?? 'this_month');
  const [periodStart, setPeriodStart] = useState(initialRange.start);
  const [periodEnd, setPeriodEnd] = useState(initialRange.end);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickTemplate = (id: string) => {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    const range = resolveDefaultPeriodRange(tpl?.defaultPeriod ?? 'this_month');
    setPeriodStart(range.start);
    setPeriodEnd(range.end);
  };

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
              onChange={(e) => pickTemplate(e.target.value)}
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
            {DEFAULT_PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
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
  const [editingLayout, setEditingLayout] = useState(false);
  // FM2 — count of inline editors (KPI cells / text sections) currently
  // open with an uncommitted draft. Closing the modal while > 0 asks for
  // confirmation so an unsaved edit isn't silently discarded.
  const activeEditorsRef = useRef(0);
  const handleEditingChange = (active: boolean) => {
    activeEditorsRef.current = Math.max(0, activeEditorsRef.current + (active ? 1 : -1));
  };
  const requestClose = () => {
    if (
      activeEditorsRef.current > 0 &&
      !window.confirm('You have an unsaved inline edit open. Close and discard it?')
    ) {
      return;
    }
    onClose();
  };

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

  // AI executive summary — generated server-side from the company's
  // books for this instance's period, then returned for review. The
  // bookkeeper still has to Save the draft text to commit it into the
  // snapshot, so nothing lands client-facing unreviewed.
  const generateAi = async (prompt: string, blockRef: string): Promise<string> => {
    const result = await api<{ text: string }>(
      `/practice/reports/instances/${instanceId}/ai-summary/generate`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...(prompt.trim() ? { prompt: prompt.trim() } : {}),
          ...(blockRef ? { blockRef } : {}),
        }),
      },
    );
    return result.text;
  };

  // Full per-instance layout editing — reuse the template LayoutEditor against
  // this draft instance's own snapshot. Editing here doesn't touch the template.
  if (editingLayout) {
    return (
      <LayoutEditor
        instanceId={instanceId}
        onClose={() => setEditingLayout(false)}
        onSaved={() => { setEditingLayout(false); reload(); }}
      />
    );
  }

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
      onClick={requestClose}
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
                onClick={() => setEditingLayout(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:bg-gray-100 px-2 py-1 rounded-md"
                title="Edit this report's blocks (add / remove / reorder / configure)"
              >
                <AlignJustify className="h-3.5 w-3.5" /> Edit layout
              </button>
            )}
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
              onClick={requestClose}
              className="text-gray-500 hover:text-gray-700 text-sm px-2"
            >
              ×
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {/* Errors and non-fatal compute notices render as a dismissible
              banner ABOVE the report — never in place of it, so a
              placeholder warning doesn't blank a rendered report. */}
          {error && (
            <div className="mb-4 max-w-2xl mx-auto flex items-start justify-between gap-3 bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">
              <span className="flex-1">{error}</span>
              <button
                onClick={() => setError(null)}
                aria-label="Dismiss"
                title="Dismiss"
                className="text-red-700 hover:text-red-900 font-bold leading-none"
              >
                ×
              </button>
            </div>
          )}
          {loading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner />
            </div>
          ) : !instance ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500 mb-2">This report could not be loaded.</p>
              <button
                onClick={() => {
                  setLoading(true);
                  reload();
                }}
                className="text-sm font-medium text-indigo-700 hover:underline"
              >
                Retry
              </button>
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
                  No data computed yet. Click <strong>Compute</strong> to fill the layout with data
                  from the books (or placeholders) so you can see the structure.
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
                  onGenerateAi={instance.status !== 'published' ? generateAi : undefined}
                  onEditingChange={handleEditingChange}
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
  onGenerateAi,
  onEditingChange,
}: {
  layout: unknown[];
  data: Record<string, unknown>;
  editable?: boolean;
  onPatch?: (patch: {
    kpiOverrides?: Record<string, string>;
    aiSummary?: string;
    textOverrides?: Record<string, string>;
  }) => Promise<void>;
  // Ask the backend to draft grounded summary text for a block. The
  // returned text lands in the edit textarea for review, not directly
  // in the snapshot.
  onGenerateAi?: (prompt: string, blockRef: string) => Promise<string>;
  // Notifies the parent when an inline editor opens/closes so the modal
  // can warn before discarding uncommitted drafts.
  onEditingChange?: (active: boolean) => void;
}) {
  const kpiValues = (data['kpis'] as Record<string, unknown>) ?? {};
  const kpiNames = (data['kpi_names'] as Record<string, string>) ?? {};
  const kpiStatus = (data['kpi_status'] as Record<string, string>) ?? {};
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
                  value={kpiValues[k] != null ? String(kpiValues[k]) : '—'}
                  status={kpiStatus[k]}
                  editable={editable}
                  onSave={onPatch ? (v) => onPatch({ kpiOverrides: { [k]: v } }) : undefined}
                  onEditingChange={onEditingChange}
                />
              ))}
            </div>
          );
        }
        if (t === 'ai_summary') {
          return (
            <EditableTextSection
              key={blockId}
              label="Summary"
              value={aiSummary}
              empty="No summary saved yet — click to write one, or generate with AI."
              editable={editable}
              onSave={onPatch ? (v) => onPatch({ aiSummary: v }) : undefined}
              onGenerate={onGenerateAi ? (prompt) => onGenerateAi(prompt, blockId) : undefined}
              onEditingChange={onEditingChange}
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
              onGenerate={onGenerateAi ? (prompt) => onGenerateAi(prompt, overrideKey) : undefined}
              onEditingChange={onEditingChange}
            />
          );
        }
        if (t === 'chart' || t === 'block' || t === 'report' || t === 'tag-segment') {
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
        if (t === 'image') {
          const src = (block['src'] as string) ?? '';
          return src ? (
            <img
              key={blockId}
              src={src}
              alt=""
              className="max-w-full rounded"
              onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
            />
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
interface BsSections {
  currentAssets: number;
  fixedAssets: number;
  otherAssets: number;
  currentLiabilities: number;
  longTermLiabilities: number;
}
interface BsSummary { assets: number; liabilities: number; equity: number; sections?: BsSections }
interface PlVsPriorYear { current: PlSummary; prior: PlSummary | null }
interface BudgetVsActualSummary {
  budgetName: string;
  fiscalYear: number;
  rows: Array<{ account: string; budgeted: number; actual: number; variance: number; variancePct: number | null }>;
  totals: { budgeted: number; actual: number; variance: number };
  truncated: boolean;
}
interface TagSegmentRow { tagId: string; tagName: string; revenue: number; expenses: number; netIncome: number }
interface SalesTaxSummary { totalSales: number; totalTax: number }
interface TopRow { name: string; amount: number }
interface TrendPoint { month: string; label: string; amount: number }
interface CfSummary { netIncome: number; operating: number; investing: number; financing: number; netChange: number }
interface TbSummary {
  rows: Array<{ account: string; debit: number; credit: number }>;
  totalDebits: number;
  totalCredits: number;
  truncated: boolean;
}
interface BankBalancesSummary {
  asOfDate: string;
  accounts: Array<{ name: string; balance: number; isInactive: boolean }>;
  totalBalance: number;
}

function fmtMoney(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Compact axis-tick labels ($1.2M / $340k) so big numbers don't clip in
// the fixed-width Y axis. Tooltips keep the full-precision fmtMoney.
function fmtMoneyTick(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  const trim = (x: number) => {
    const s = x.toFixed(1);
    return s.endsWith('.0') ? s.slice(0, -2) : s;
  };
  if (abs >= 1e9) return `${sign}$${trim(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}$${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}$${trim(abs / 1e3)}k`;
  return `${sign}$${Math.round(abs)}`;
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
    (blockType === 'tag-segment' ? 'tag segments' : '');
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
    case 'top_vendors':
    case 'expense_by_category': {
      const rows = (payload.data as TopRow[]) ?? [];
      const heading =
        payload.type === 'top_customers'
          ? 'Top Customers'
          : payload.type === 'top_vendors'
            ? 'Top Vendors'
            : 'Expenses by Category';
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              <AgingCell label="Current" v={b.current} />
              <AgingCell label="1–30" v={b.days1to30} />
              <AgingCell label="31–60" v={b.days31to60} />
              <AgingCell label="61–90" v={b.days61to90} />
              <AgingCell label="90+" v={b.over90} />
              <div className="col-span-2 md:col-span-5 text-right text-gray-700 mt-1">
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
            <BsTable b={b} />
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
    case 'revenue_trend_12m':
    case 'expense_trend_12m':
    case 'cash_balance_trend':
    case 'net_income_trend_12m':
    case 'gross_margin_trend_12m': {
      const pts = (payload.data as TrendPoint[]) ?? [];
      const heading =
        payload.type === 'revenue_trend_12m'
          ? 'Revenue Trend (12 Months)'
          : payload.type === 'expense_trend_12m'
            ? 'Expense Trend (12 Months)'
            : payload.type === 'net_income_trend_12m'
              ? 'Net Income Trend (12 Months)'
              : payload.type === 'gross_margin_trend_12m'
                ? 'Gross Margin % Trend (12 Months)'
                : 'Cash Balance Trend (12 Months)';
      const color =
        payload.type === 'expense_trend_12m'
          ? '#f59e0b'
          : payload.type === 'cash_balance_trend'
            ? '#0ea5e9'
            : payload.type === 'net_income_trend_12m' || payload.type === 'gross_margin_trend_12m'
              ? '#16a34a'
              : '#4f46e5';
      return (
        <Frame label="Chart" title={heading}>
          {pts.length === 0 ? (
            <p className="text-xs text-gray-500 italic">No data.</p>
          ) : (
            <TrendChart
              points={pts}
              color={color}
              percent={payload.type === 'gross_margin_trend_12m'}
            />
          )}
        </Frame>
      );
    }
    case 'cash_flow': {
      const c = (payload.data as CfSummary) ?? null;
      return (
        <Frame title="Cash Flow">
          {!c ? <p className="text-xs text-gray-500 italic">No data.</p> : <CfTable c={c} />}
        </Frame>
      );
    }
    case 'trial_balance': {
      const t = (payload.data as TbSummary) ?? null;
      return (
        <Frame title="Trial Balance">
          {!t || t.rows.length === 0 ? (
            <p className="text-xs text-gray-500 italic">No data.</p>
          ) : (
            <TbTable t={t} />
          )}
        </Frame>
      );
    }
    case 'bank_balances': {
      const b = (payload.data as BankBalancesSummary) ?? null;
      return (
        <Frame title="Bank Account Balances">
          {!b || b.accounts.length === 0 ? (
            <p className="text-xs text-gray-500 italic">No bank accounts.</p>
          ) : (
            <BankBalancesTable b={b} />
          )}
        </Frame>
      );
    }
    case 'budget_vs_actual': {
      const d = (payload.data as BudgetVsActualSummary) ?? null;
      return (
        <Frame title={d ? `Budget vs. Actual — ${d.budgetName}` : 'Budget vs. Actual'}>
          {!d || d.rows.length === 0 ? (
            <p className="text-xs text-gray-500 italic">No budgeted activity in this period.</p>
          ) : (
            <BudgetVsActualTable d={d} />
          )}
        </Frame>
      );
    }
    case 'tag_segments': {
      const rows = (payload.data as TagSegmentRow[]) ?? [];
      return (
        <Frame title="Tag Segments">
          {rows.length === 0 ? (
            <p className="text-xs text-gray-500 italic">No activity in this period.</p>
          ) : (
            <TagSegmentsTable rows={rows} />
          )}
        </Frame>
      );
    }
    case 'sales_tax': {
      const s = (payload.data as SalesTaxSummary) ?? null;
      return (
        <Frame title="Sales Tax Liability">
          {!s ? (
            <p className="text-xs text-gray-500 italic">No data.</p>
          ) : (
            <SalesTaxTable s={s} />
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
            tickFormatter={fmtMoneyTick}
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
              tickFormatter={fmtMoneyTick}
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

// 12-month single-series bar chart shared by the trend blocks.
// Negative months render red so a loss or overdraft is visible at a
// glance. `percent` switches the axis/tooltip to % (gross margin).
function TrendChart({
  points,
  color,
  percent,
}: {
  points: TrendPoint[];
  color: string;
  percent?: boolean;
}) {
  const data = points.map((p) => ({ name: p.label, amount: p.amount }));
  const fmtPctTick = (v: unknown) => `${Number(v)}%`;
  const fmtPct = (n: number) => `${n.toFixed(1)}%`;
  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 12, left: 12, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-40} textAnchor="end" height={38} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={percent ? fmtPctTick : fmtMoneyTick}
            width={70}
          />
          <Tooltip
            formatter={((v: unknown) =>
              percent ? fmtPct(Number(v)) : fmtMoney(Number(v))) as never}
          />
          <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={`${entry.name}-${i}`} fill={entry.amount < 0 ? '#dc2626' : color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CfTable({ c }: { c: CfSummary }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        <tr><td className="py-1 text-gray-700">Operating Activities</td><td className="py-1 text-right font-medium">{fmtMoney(c.operating)}</td></tr>
        <tr><td className="py-1 text-gray-700">Investing Activities</td><td className="py-1 text-right">{fmtMoney(c.investing)}</td></tr>
        <tr><td className="py-1 text-gray-700">Financing Activities</td><td className="py-1 text-right">{fmtMoney(c.financing)}</td></tr>
        <tr className="border-t border-gray-200"><td className="py-1 text-gray-900 font-semibold">Net Change in Cash</td><td className="py-1 text-right font-bold">{fmtMoney(c.netChange)}</td></tr>
        <tr><td className="py-1 text-gray-500 text-xs">Net Income (accrual)</td><td className="py-1 text-right text-xs text-gray-500">{fmtMoney(c.netIncome)}</td></tr>
      </tbody>
    </table>
  );
}

function TbTable({ t }: { t: TbSummary }) {
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-gray-500">
            <th className="text-left py-1 font-semibold">Account</th>
            <th className="text-right py-1 font-semibold">Debit</th>
            <th className="text-right py-1 font-semibold">Credit</th>
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r) => (
            <tr key={r.account} className="border-b border-gray-100 last:border-0">
              <td className="py-1 pr-2 text-gray-800">{r.account}</td>
              <td className="py-1 text-right text-gray-900">{r.debit !== 0 ? fmtMoney(r.debit) : ''}</td>
              <td className="py-1 text-right text-gray-900">{r.credit !== 0 ? fmtMoney(r.credit) : ''}</td>
            </tr>
          ))}
          <tr className="border-t border-gray-200 font-semibold">
            <td className="py-1 text-gray-900">Totals</td>
            <td className="py-1 text-right">{fmtMoney(t.totalDebits)}</td>
            <td className="py-1 text-right">{fmtMoney(t.totalCredits)}</td>
          </tr>
        </tbody>
      </table>
      {t.truncated && (
        <p className="mt-1 text-[11px] text-gray-500">Showing the first {t.rows.length} accounts.</p>
      )}
    </div>
  );
}

// Balance Sheet embed — three totals plus indented section subtotals
// (current/fixed/other assets, current/long-term liabilities) when the
// snapshot carries them (F10; older snapshots omit `sections`).
function BsTable({ b }: { b: BsSummary }) {
  const s = b.sections;
  const sub = (label: string, v: number) => (
    <tr key={label}>
      <td className="py-0.5 pl-4 text-xs text-gray-500">{label}</td>
      <td className="py-0.5 text-right text-xs text-gray-600">{fmtMoney(v)}</td>
    </tr>
  );
  return (
    <table className="w-full text-sm">
      <tbody>
        <tr><td className="py-1 text-gray-700">Total Assets</td><td className="py-1 text-right font-medium">{fmtMoney(b.assets)}</td></tr>
        {s && sub('Current Assets', s.currentAssets)}
        {s && sub('Fixed Assets', s.fixedAssets)}
        {s && sub('Other Assets', s.otherAssets)}
        <tr><td className="py-1 text-gray-700">Total Liabilities</td><td className="py-1 text-right font-medium">{fmtMoney(b.liabilities)}</td></tr>
        {s && sub('Current Liabilities', s.currentLiabilities)}
        {s && sub('Long-Term Liabilities', s.longTermLiabilities)}
        <tr><td className="py-1 text-gray-700">Total Equity</td><td className="py-1 text-right font-medium">{fmtMoney(b.equity)}</td></tr>
      </tbody>
    </table>
  );
}

// Budget vs. Actual block (F1). Negative variance renders red.
function BudgetVsActualTable({ d }: { d: BudgetVsActualSummary }) {
  const varClass = (v: number) => (v < 0 ? 'text-red-600' : 'text-gray-900');
  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-gray-500">
            <th className="text-left py-1 font-semibold">Account</th>
            <th className="text-right py-1 font-semibold">Budget</th>
            <th className="text-right py-1 font-semibold">Actual</th>
            <th className="text-right py-1 font-semibold">Variance</th>
          </tr>
        </thead>
        <tbody>
          {d.rows.map((r) => (
            <tr key={r.account} className="border-b border-gray-100 last:border-0">
              <td className="py-1 pr-2 text-gray-800">{r.account}</td>
              <td className="py-1 text-right text-gray-900">{fmtMoney(r.budgeted)}</td>
              <td className="py-1 text-right text-gray-900">{fmtMoney(r.actual)}</td>
              <td className={`py-1 text-right font-medium ${varClass(r.variance)}`}>{fmtMoney(r.variance)}</td>
            </tr>
          ))}
          <tr className="border-t border-gray-200 font-semibold">
            <td className="py-1 text-gray-900">Net Income</td>
            <td className="py-1 text-right">{fmtMoney(d.totals.budgeted)}</td>
            <td className="py-1 text-right">{fmtMoney(d.totals.actual)}</td>
            <td className={`py-1 text-right ${varClass(d.totals.variance)}`}>{fmtMoney(d.totals.variance)}</td>
          </tr>
        </tbody>
      </table>
      {d.truncated && (
        <p className="mt-1 text-[11px] text-gray-500">Showing the first {d.rows.length} budget lines.</p>
      )}
    </div>
  );
}

// Tag-segment block (F2) — one P&L summary row per tag.
function TagSegmentsTable({ rows }: { rows: TagSegmentRow[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[10px] uppercase tracking-wide text-gray-500">
          <th className="text-left py-1 font-semibold">Segment</th>
          <th className="text-right py-1 font-semibold">Revenue</th>
          <th className="text-right py-1 font-semibold">Expenses</th>
          <th className="text-right py-1 font-semibold">Net Income</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.tagId} className="border-b border-gray-100 last:border-0">
            <td className="py-1 pr-2 text-gray-800">{r.tagName}</td>
            <td className="py-1 text-right text-gray-900">{fmtMoney(r.revenue)}</td>
            <td className="py-1 text-right text-gray-900">{fmtMoney(r.expenses)}</td>
            <td className={`py-1 text-right font-medium ${r.netIncome < 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {fmtMoney(r.netIncome)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Sales Tax Liability embed (F5).
function SalesTaxTable({ s }: { s: SalesTaxSummary }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        <tr><td className="py-1 text-gray-700">Taxable Sales</td><td className="py-1 text-right">{fmtMoney(s.totalSales)}</td></tr>
        <tr className="border-t border-gray-200"><td className="py-1 text-gray-900 font-semibold">Sales Tax Collected</td><td className="py-1 text-right font-bold">{fmtMoney(s.totalTax)}</td></tr>
      </tbody>
    </table>
  );
}

function BankBalancesTable({ b }: { b: BankBalancesSummary }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {b.accounts.map((a) => (
          <tr key={a.name} className="border-b border-gray-100 last:border-0">
            <td className="py-1 pr-2 text-gray-800">{a.name}</td>
            <td className="py-1 text-right text-gray-900 font-medium">{fmtMoney(a.balance)}</td>
          </tr>
        ))}
        <tr className="border-t border-gray-200 font-semibold">
          <td className="py-1 text-gray-900">Total</td>
          <td className="py-1 text-right">{fmtMoney(b.totalBalance)}</td>
        </tr>
      </tbody>
    </table>
  );
}

// ── Editable cells ──────────────────────────────────────────────

// F7 — red/amber/green target dot on KPI tiles. Absent status renders
// nothing so untargeted KPIs look exactly as before.
const KPI_STATUS_COLORS: Record<string, string> = {
  green: 'bg-green-600',
  amber: 'bg-amber-500',
  red: 'bg-red-600',
};

function KpiStatusDot({ status }: { status?: string }) {
  const color = status ? KPI_STATUS_COLORS[status] : undefined;
  if (!color) return null;
  return (
    <span
      title={`Status: ${status}`}
      className={`inline-block h-2 w-2 rounded-full mr-1.5 align-middle ${color}`}
    />
  );
}

function KpiCard({
  label,
  value,
  status,
  editable,
  onSave,
  onEditingChange,
}: {
  label: string;
  value: string;
  status?: string;
  editable?: boolean;
  onSave?: (v: string) => Promise<void>;
  onEditingChange?: (active: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  // One commit per edit session: Enter fires commit, then the input's
  // blur (unmount / focus move) fires it again — without this guard the
  // override PATCH is sent twice. Escape also closes the session so the
  // trailing blur doesn't save a cancelled draft.
  const sessionDoneRef = useRef(false);

  useEffect(() => {
    if (!editing || !onEditingChange) return;
    onEditingChange(true);
    return () => onEditingChange(false);
  }, [editing, onEditingChange]);

  const enter = () => {
    if (!editable || !onSave) return;
    setDraft(value);
    sessionDoneRef.current = false;
    setEditing(true);
  };
  const commit = async () => {
    if (sessionDoneRef.current) return;
    sessionDoneRef.current = true;
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
              sessionDoneRef.current = true;
              setEditing(false);
              setDraft(value);
            }
          }}
          className="mt-0.5 w-full text-base font-semibold text-gray-900 bg-white border border-indigo-300 rounded px-1 outline-none"
        />
      ) : (
        <p className="mt-0.5 text-base font-semibold text-gray-900">
          <KpiStatusDot status={status} />
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
  onGenerate,
  onEditingChange,
}: {
  label: string;
  value: string;
  empty: string;
  compact?: boolean;
  editable?: boolean;
  onSave?: (v: string) => Promise<void>;
  // When present, the edit surface offers "Generate with AI": the
  // backend drafts grounded text (optionally steered by a custom
  // prompt) into the textarea for review before Save.
  onGenerate?: (prompt: string) => Promise<string>;
  onEditingChange?: (active: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  // Default generation prompt — editable before generating. Kept in sync
  // with the server-side base instruction in portal-reports.service.ts.
  const [aiPrompt, setAiPrompt] = useState('Provide a 100 word summary of the financials');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing || !onEditingChange) return;
    onEditingChange(true);
    return () => onEditingChange(false);
  }, [editing, onEditingChange]);

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
      setAiOpen(false);
      setAiError(null);
    }
  };

  const generate = async () => {
    if (!onGenerate) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const text = await onGenerate(aiPrompt);
      setDraft(text);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Generation failed.');
    } finally {
      setAiBusy(false);
    }
  };

  if (editing) {
    return (
      <section
        className={`border border-indigo-300 rounded-md p-3 ${compact ? '' : 'bg-gray-50'}`}
      >
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {label}
          </p>
          {onGenerate && (
            <button
              onClick={() => setAiOpen((o) => !o)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50 px-1.5 py-0.5 rounded"
              title="Draft this text from the company's books"
            >
              <Sparkles className="h-3 w-3" /> Generate with AI
            </button>
          )}
        </div>
        {aiOpen && onGenerate && (
          <div className="mb-2 border border-indigo-200 bg-indigo-50/50 rounded-md p-2 space-y-1.5">
            <label className="block text-[11px] text-gray-700">
              Optional instructions for the AI (tone, focus, things to mention):
              <textarea
                rows={2}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Focus on the cash position and keep it under 100 words."
                className="mt-1 w-full border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>
            {aiError && <p className="text-[11px] text-red-700">{aiError}</p>}
            <div className="flex justify-end">
              <button
                onClick={generate}
                disabled={aiBusy}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-2 py-1 rounded"
              >
                <Sparkles className="h-3 w-3" />
                {aiBusy ? 'Generating…' : draft.trim() ? 'Regenerate draft' : 'Generate draft'}
              </button>
            </div>
          </div>
        )}
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
              setAiOpen(false);
              setAiError(null);
            }}
            className="text-xs text-gray-600 hover:bg-gray-100 px-2 py-1 rounded"
          >
            Cancel
          </button>
          <button
            onClick={commit}
            disabled={saving || aiBusy}
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
      {editable && onSave && onGenerate && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDraft(value);
            setEditing(true);
            setAiOpen(true);
          }}
          className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 hover:underline"
        >
          <Sparkles className="h-3 w-3" /> Generate with AI
        </button>
      )}
    </section>
  );
}

export default ReportBuilderPage;
