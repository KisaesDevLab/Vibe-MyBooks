// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Admin — CPA report letters (SSARS 21).
//
// System-level engagement-letter templates (compilation / preparation) shared
// across the appliance. Master-detail: left list, right WYSIWYG editor with an
// "Insert variable" menu. Mirrors CoaTemplatesPage's React Query + apiClient
// pattern. Super-admin only (guarded by AdminRoute + the admin API).

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Trash2, Save, Copy } from 'lucide-react';
import {
  REPORT_LETTER_TYPES,
  REPORT_LETTER_TITLES,
  LETTER_VARIABLES,
  LETTER_FONT_OPTIONS,
  type ReportLetter,
  type ReportLetterType,
} from '@kis-books/shared';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toaster';
import { RichTextEditor } from './RichTextEditor';

const TYPE_LABELS: Record<ReportLetterType, string> = {
  compilation: 'Compilation (AR-C 80)',
  preparation: 'Preparation (AR-C 70)',
};

interface EditState {
  id: string | null;
  name: string;
  letterType: ReportLetterType;
  title: string;
  fontFamily: string;
  bodyHtml: string;
  isActive: boolean;
}

const BLANK: EditState = { id: null, name: '', letterType: 'compilation', title: '', fontFamily: 'default', bodyHtml: '', isActive: true };

const toEdit = (l: ReportLetter): EditState => ({
  id: l.id,
  name: l.name,
  letterType: l.letterType,
  title: l.title ?? '',
  fontFamily: l.fontFamily ?? 'default',
  bodyHtml: l.bodyHtml,
  isActive: l.isActive,
});

export function CpaLettersPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [edit, setEdit] = useState<EditState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const lettersQuery = useQuery({
    queryKey: ['admin', 'report-letters'],
    queryFn: async () => (await apiClient<{ letters: ReportLetter[] }>('/admin/report-letters')).letters,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'report-letters'] });

  const saveMutation = useMutation({
    mutationFn: async (state: EditState) => {
      const body = JSON.stringify({
        name: state.name,
        letterType: state.letterType,
        // Blank printed title → null so the renderer uses the standard SSARS
        // title for the type.
        title: state.title.trim() ? state.title.trim() : null,
        fontFamily: state.fontFamily,
        bodyHtml: state.bodyHtml,
        isActive: state.isActive,
      });
      if (state.id) {
        return (await apiClient<{ letter: ReportLetter }>(`/admin/report-letters/${state.id}`, { method: 'PUT', body })).letter;
      }
      return (await apiClient<{ letter: ReportLetter }>('/admin/report-letters', { method: 'POST', body })).letter;
    },
    onSuccess: (letter) => {
      invalidate();
      setEdit(toEdit(letter));
      toast.success('Letter saved');
    },
    onError: (err: Error) => toast.error('Could not save letter', { detail: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient<{ message: string }>(`/admin/report-letters/${id}`, { method: 'DELETE' }),
    onSuccess: () => { invalidate(); setEdit(null); setConfirmDelete(false); toast.success('Letter deleted'); },
    onError: (err: Error) => { setConfirmDelete(false); toast.error('Could not delete letter', { detail: err.message }); },
  });

  const letters = lettersQuery.data ?? [];
  const variables = useMemo(() => LETTER_VARIABLES.map((v) => ({ key: v.key, label: v.label })), []);

  const openLetter = (l: ReportLetter) => setEdit(toEdit(l));

  // Duplicate → open the editor pre-filled with a copy (id null, "(Copy)"
  // name, not a default). Saving creates a new letter via the POST path.
  const duplicateLetter = (l: ReportLetter) => {
    setConfirmDelete(false);
    setEdit({ ...toEdit(l), id: null, name: `${l.name} (Copy)` });
  };

  const nameValid = (edit?.name.trim().length ?? 0) > 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary-600" /> CPA Report Letters
        </h1>
        <Button onClick={() => setEdit({ ...BLANK })}>
          <Plus className="h-4 w-4 mr-1" /> New letter
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">Templates</h2>
          {lettersQuery.isLoading ? (
            <LoadingSpinner className="py-8" />
          ) : letters.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No letters yet.</p>
          ) : (
            <ul className="space-y-1">
              {letters.map((l) => (
                <li key={l.id} className={`flex items-stretch gap-1 rounded-lg ${edit?.id === l.id ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                  <button
                    type="button"
                    onClick={() => openLetter(l)}
                    className="flex-1 min-w-0 text-left px-3 py-2 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-800 truncate">{l.name}</span>
                      {l.isDefault && <span className="text-[10px] uppercase tracking-wide text-gray-400 border border-gray-200 rounded px-1">default</span>}
                      {!l.isActive && <span className="text-[10px] uppercase tracking-wide text-amber-600 border border-amber-200 rounded px-1">inactive</span>}
                    </div>
                    <div className="text-xs text-gray-500">{TYPE_LABELS[l.letterType]}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateLetter(l)}
                    aria-label={`Duplicate ${l.name}`}
                    title="Duplicate"
                    className="shrink-0 px-2 my-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Editor */}
        <section className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          {!edit ? (
            <p className="text-sm text-gray-500 py-16 text-center">Select a letter to edit, or create a new one.</p>
          ) : (
            <div className="space-y-4">
              <Input
                label="Name"
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                maxLength={200}
                placeholder="e.g. Accountant's Compilation Report"
                required
              />
              <div className="flex items-end gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={edit.letterType}
                    onChange={(e) => setEdit({ ...edit, letterType: e.target.value as ReportLetterType })}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    aria-label="Letter type"
                  >
                    {REPORT_LETTER_TYPES.map((t) => (
                      <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Font</label>
                  <select
                    value={edit.fontFamily}
                    onChange={(e) => setEdit({ ...edit, fontFamily: e.target.value })}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    aria-label="Letter font"
                  >
                    {LETTER_FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
                  <input
                    type="checkbox"
                    checked={edit.isActive}
                    onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Active
                </label>
              </div>
              <Input
                label="Printed title (heading)"
                value={edit.title}
                onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                maxLength={200}
                placeholder={REPORT_LETTER_TITLES[edit.letterType]}
              />
              <p className="-mt-3 text-xs text-gray-500">
                The heading printed above the letter on the report. Leave blank to use the standard title
                (<span className="italic">{REPORT_LETTER_TITLES[edit.letterType]}</span>).
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                <RichTextEditor
                  value={edit.bodyHtml}
                  onChange={(html) => setEdit({ ...edit, bodyHtml: html })}
                  variables={variables}
                  ariaLabel="Letter body"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Variables like <code>{'{{client_name}}'}</code> resolve at render time from the company and the report pack's period + basis.
                </p>
              </div>
              <div className="flex items-center justify-between pt-2">
                <Button onClick={() => saveMutation.mutate(edit)} loading={saveMutation.isPending} disabled={!nameValid}>
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
                {edit.id && (
                  <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete letter?"
        message="This removes the template. Report packs that referenced it keep rendering without a letter."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => edit?.id && deleteMutation.mutate(edit.id)}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
