// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Pencil, Trash2, Check } from 'lucide-react';
import { getReportDef } from '@kis-books/shared';
import {
  useReportPackTemplates,
  useApplyPackTemplate,
  useRenamePackTemplate,
  useDeletePackTemplate,
  useSavePackAsTemplate,
} from '../../../api/hooks/useReportPacks';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { useToast } from '../../../components/ui/Toaster';

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

const reportLabel = (id: string) => getReportDef(id)?.label ?? id;

// Staff: pick a firm template and create a pack for this client from it.
// Super admins can also rename and delete templates here.
export function PackTemplatesModal({ isSuperAdmin, onClose }: { isSuperAdmin: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { data, isLoading, isError } = useReportPackTemplates();
  const apply = useApplyPackTemplate();
  const rename = useRenamePackTemplate();
  const remove = useDeletePackTemplate();
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const templates = data?.templates ?? [];

  return (
    <Shell title="Create a pack from a template" onClose={onClose}>
      {isLoading ? (
        <LoadingSpinner className="py-8" />
      ) : isError ? (
        <p className="text-sm text-red-700">Could not load templates.</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-gray-500">
          No templates yet. {isSuperAdmin ? 'Use "Save as template" on any pack to add one.' : 'Ask your administrator to save one.'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {templates.map((t) => (
            <li key={t.id} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {editing?.id === t.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        aria-label="Template name"
                        value={editing.name}
                        onChange={(e) => setEditing({ id: t.id, name: e.target.value })}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        aria-label="Save name"
                        className="rounded p-1 text-emerald-700 hover:bg-emerald-50"
                        onClick={() => rename.mutate({ id: t.id, name: editing.name }, {
                          onSuccess: () => setEditing(null),
                          onError: (e: Error) => toast.error('Could not rename', { detail: e.message }),
                        })}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  )}
                  {t.description && <p className="text-xs text-gray-500">{t.description}</p>}
                  <p className="mt-0.5 text-xs text-gray-500">
                    {t.reportCount} report{t.reportCount === 1 ? '' : 's'}: {t.reportIds.map(reportLabel).join(', ')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    loading={apply.isPending && apply.variables?.templateId === t.id}
                    disabled={apply.isPending}
                    onClick={() => apply.mutate({ templateId: t.id }, {
                      onSuccess: (pack) => {
                        toast.success(`Created "${pack.name}" from the template`);
                        onClose();
                        navigate(`/reports/packs/${pack.id}/edit`);
                      },
                      onError: (e: Error) => toast.error('Could not create the pack', { detail: e.message }),
                    })}
                  >
                    Use template
                  </Button>
                  {isSuperAdmin && (
                    <>
                      <button type="button" aria-label={`Rename ${t.name}`} onClick={() => setEditing({ id: t.id, name: t.name })} className="rounded p-1.5 text-gray-400 hover:text-gray-700">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${t.name}`}
                        onClick={() => {
                          if (window.confirm(`Delete the template "${t.name}"? Packs already created from it are not affected.`)) {
                            remove.mutate(t.id, { onError: (e: Error) => toast.error('Could not delete', { detail: e.message }) });
                          }
                        }}
                        className="rounded p-1.5 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-gray-400">
        The new pack opens in the editor. Tag and account filters are not carried in templates — set them for this client if needed.
      </p>
    </Shell>
  );
}

// Super admin: save one pack as an install-wide template.
export function SaveAsTemplateDialog({ pack, onClose }: { pack: { id: string; name: string }; onClose: () => void }) {
  const toast = useToast();
  const save = useSavePackAsTemplate();
  const [name, setName] = useState(pack.name);
  const [description, setDescription] = useState('');
  return (
    <Shell title="Save as template" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          Staff in every client can create a pack from this template. Its reports, period, options, cover page, footer and
          filename are copied; tag and account filters are left out because they belong to this client.
        </p>
        <label className="block text-sm">
          <span className="text-gray-700">Template name</span>
          <input aria-label="Template name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="text-gray-700">Description (optional)</span>
          <input aria-label="Template description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={save.isPending}
            disabled={!name.trim()}
            onClick={() => save.mutate({ packId: pack.id, name: name.trim(), description: description.trim() || null }, {
              onSuccess: (r) => { toast.success(`Saved template "${r.template.name}"`); onClose(); },
              onError: (e: Error) => toast.error('Could not save the template', { detail: e.message }),
            })}
          >
            Save template
          </Button>
        </div>
      </div>
    </Shell>
  );
}
