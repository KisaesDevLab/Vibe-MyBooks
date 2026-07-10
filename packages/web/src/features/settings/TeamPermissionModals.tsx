// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PermissionMap } from '@kis-books/shared';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PermissionsGrid } from './PermissionsGrid';
import { Plus, Trash2 } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string | null;
  permissions: PermissionMap;
}

function useTemplates() {
  return useQuery({
    queryKey: ['company', 'permission-templates'],
    queryFn: () => apiClient<{ templates: Template[] }>('/company/permission-templates'),
  });
}

function ModalShell({ title, subtitle, onClose, children, wide }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className={`bg-white rounded-lg shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[90vh] flex flex-col`}>
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
        <div className="px-6 py-3 border-t border-gray-100 flex justify-end">
          <Button variant="secondary" onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Templates manager ───────────────────────────────────────

export function TemplatesModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useTemplates();
  const [editing, setEditing] = useState<Template | 'new' | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [error, setError] = useState('');

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['company', 'permission-templates'] });

  const startEdit = (t: Template | 'new') => {
    setError('');
    setEditing(t);
    if (t === 'new') { setName(''); setDescription(''); setPermissions({}); }
    else { setName(t.name); setDescription(t.description ?? ''); setPermissions(t.permissions ?? {}); }
  };

  const save = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({ name, description, permissions });
      return editing === 'new'
        ? apiClient('/company/permission-templates', { method: 'POST', body })
        : apiClient(`/company/permission-templates/${(editing as Template).id}`, { method: 'PUT', body });
    },
    onSuccess: () => { invalidate(); setEditing(null); },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient(`/company/permission-templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => { invalidate(); setEditing(null); },
  });

  return (
    <ModalShell title="Permission Templates" subtitle="Reusable access sets you can assign to bookkeepers." onClose={onClose} wide>
      {editing ? (
        <div className="space-y-4">
          <Input label="Template name" value={name} onChange={(e) => setName(e.target.value)} required />
          <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <PermissionsGrid value={permissions} onChange={setPermissions} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-between">
            <div>
              {editing !== 'new' && (
                <Button variant="danger" onClick={() => remove.mutate((editing as Template).id)} loading={remove.isPending}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!name}>Save</Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {isLoading ? (
            <div className="py-8 text-center text-gray-400">Loading…</div>
          ) : (data?.templates ?? []).length === 0 ? (
            <p className="text-sm text-gray-500 py-4">No templates yet. Create one to tailor bookkeeper access.</p>
          ) : (
            data!.templates.map((t) => (
              <button key={t.id} onClick={() => startEdit(t)}
                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                <div className="text-sm font-medium text-gray-900">{t.name}</div>
                {t.description && <div className="text-xs text-gray-500">{t.description}</div>}
              </button>
            ))
          )}
          <Button variant="secondary" onClick={() => startEdit('new')} className="mt-2">
            <Plus className="h-4 w-4 mr-1" /> New Template
          </Button>
        </div>
      )}
    </ModalShell>
  );
}

// ─── Per-user editor ─────────────────────────────────────────

interface UserPermRow { templateId: string | null; overrides: PermissionMap }

export function UserPermissionsModal({ userId, email, onClose }: { userId: string; email: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: tmplData } = useTemplates();
  const { data, isLoading } = useQuery({
    queryKey: ['company', 'users', userId, 'permissions'],
    queryFn: () => apiClient<{ permissions: UserPermRow | null }>(`/company/users/${userId}/permissions`),
  });

  const [templateId, setTemplateId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<PermissionMap>({});
  const [hydrated, setHydrated] = useState(false);
  if (!hydrated && !isLoading && data) {
    setTemplateId(data.permissions?.templateId ?? null);
    setOverrides(data.permissions?.overrides ?? {});
    setHydrated(true);
  }

  const save = useMutation({
    mutationFn: () => apiClient(`/company/users/${userId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ templateId, overrides }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', 'users', userId, 'permissions'] });
      onClose();
    },
  });

  return (
    <ModalShell title="Permissions" subtitle={`${email} — bookkeeper access`} onClose={onClose} wide>
      {isLoading ? (
        <div className="py-8 text-center text-gray-400">Loading…</div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base template</label>
            <select
              value={templateId ?? ''}
              onChange={(e) => setTemplateId(e.target.value || null)}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— No template (overrides only) —</option>
              {(tmplData?.templates ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              The template sets the baseline; overrides below take precedence. Anything left as None is denied.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Overrides</label>
            <PermissionsGrid value={overrides} onChange={setOverrides} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => save.mutate()} loading={save.isPending}>Save</Button>
          </div>
        </div>
      )}
    </ModalShell>
  );
}
