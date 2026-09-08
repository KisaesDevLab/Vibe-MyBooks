// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Admin → Firms (super admin): every firm on the box with live counts,
// create / rename / deactivate / delete, and a members drawer. Firm CRUD
// rides the regular /firms routes — a super admin passes every gate there,
// the system-managed appliance firm included. Per-staff tenant access is
// still edited on the firm's own Staff page (linked from the drawer).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Plus, Search, Pencil, Power, Trash2, Users, X, ExternalLink } from 'lucide-react';
import type { AdminFirmSummary, FirmRole } from '@kis-books/shared';
import { APPLIANCE_FIRM_SLUG } from '@kis-books/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toaster';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { isApiError } from '../../api/client';
import {
  useAdminFirms, useUpdateFirm, useDeleteFirm,
  useFirmUsers, useInviteFirmUser, useUpdateFirmUser, useRemoveFirmUser,
} from '../../api/hooks/useFirms';
import { CreateFirmDialog } from '../firm/CreateFirmDialog';

export function FirmsAdminPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const { data, isLoading, isError, refetch } = useAdminFirms({ search: debounced });
  const update = useUpdateFirm();
  const remove = useDeleteFirm();

  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [members, setMembers] = useState<AdminFirmSummary | null>(null);
  const [pending, setPending] = useState<{ title: string; message: string; confirmLabel: string; variant?: 'primary' | 'danger'; onConfirm: () => void } | null>(null);

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;

  const firms = data?.firms ?? [];

  const saveRename = () => {
    if (!renaming || !renaming.name.trim()) return;
    update.mutate({ firmId: renaming.id, patch: { name: renaming.name.trim() } }, {
      onSuccess: () => { toast.success('Firm renamed'); setRenaming(null); },
      onError: (e) => toast.error('Could not rename', { detail: (e as Error).message }),
    });
  };

  const toggleActive = (f: AdminFirmSummary) => {
    setPending({
      title: f.isActive ? `Deactivate "${f.name}"?` : `Reactivate "${f.name}"?`,
      message: f.isActive
        ? 'A deactivated firm authorizes nobody: its members lose the Firm and Practice surfaces and can no longer create client companies. Their existing per-tenant access is not changed.'
        : 'Members regain the firm surfaces.',
      confirmLabel: f.isActive ? 'Deactivate' : 'Reactivate',
      variant: f.isActive ? 'danger' : 'primary',
      onConfirm: () => update.mutate({ firmId: f.id, patch: { isActive: !f.isActive } }, {
        onError: (e) => toast.error('Could not update firm', { detail: (e as Error).message }),
      }),
    });
  };

  const del = (f: AdminFirmSummary) => {
    setPending({
      title: `Delete "${f.name}"?`,
      message: 'This permanently removes the firm and its memberships. Refused while any tenant is still assigned to it — unassign them first.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: () => remove.mutate(f.id, {
        onSuccess: () => toast.success('Firm deleted'),
        onError: (e) => toast.error(
          isApiError(e) && e.code === 'FIRM_HAS_ACTIVE_ASSIGNMENTS'
            ? 'This firm still manages tenants. Reassign or unassign them first.'
            : 'Could not delete firm',
          { detail: (e as Error).message },
        ),
      }),
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase className="h-6 w-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Firms</h1>
          <span className="text-sm text-gray-500">({data?.total ?? 0})</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search firms..."
              className="pl-9 pr-4 py-2 rounded-lg border border-gray-300 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New firm
          </Button>
        </div>
      </div>

      <p className="text-sm text-gray-500">
        Firm admins automatically get accountant access to every tenant their firm manages. Assign a
        tenant to a firm from the tenant&apos;s detail page, or from the firm&apos;s own Managed tenants tab.
      </p>

      {firms.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          {search ? 'No firms match your search.' : 'No firms yet.'}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-600">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Members</th>
                <th className="px-4 py-3 font-medium text-right">Tenants</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {firms.map((f) => {
                const isAppliance = f.slug === APPLIANCE_FIRM_SLUG;
                return (
                  <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {renaming?.id === f.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            value={renaming.name}
                            onChange={(e) => setRenaming({ id: f.id, name: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setRenaming(null); }}
                            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                          />
                          <Button size="sm" onClick={saveRename} loading={update.isPending}>Save</Button>
                          <button type="button" onClick={() => setRenaming(null)} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
                        </div>
                      ) : (
                        <span>
                          {f.name}
                          {f.superAdminManaged && (
                            <span className="ml-2 text-[11px] rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 font-medium">System-managed</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{f.slug}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${f.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {f.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{f.memberCount}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{f.tenantCount}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(f.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <button type="button" onClick={() => setMembers(f)} className="p-1.5 rounded hover:bg-gray-200 text-gray-700" title="Members">
                          <Users className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => setRenaming({ id: f.id, name: f.name })} className="p-1.5 rounded hover:bg-gray-200 text-gray-700" title="Rename">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(f)}
                          disabled={isAppliance}
                          className={`p-1.5 rounded hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed ${f.isActive ? 'text-green-600' : 'text-red-500'}`}
                          title={isAppliance ? 'The system-managed firm cannot be deactivated' : f.isActive ? 'Deactivate' : 'Reactivate'}
                        >
                          <Power className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => del(f)}
                          disabled={isAppliance || f.tenantCount > 0}
                          className="p-1.5 rounded hover:bg-rose-50 text-rose-600 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isAppliance ? 'The system-managed firm cannot be deleted' : f.tenantCount > 0 ? 'Unassign its tenants first' : 'Delete'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <Link to={`/firm/${f.id}/staff`} className="p-1.5 rounded hover:bg-gray-200 text-gray-500" title="Open firm workspace">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={!!pending}
        title={pending?.title ?? ''}
        message={pending?.message}
        confirmLabel={pending?.confirmLabel ?? 'Confirm'}
        variant={pending?.variant ?? 'primary'}
        onCancel={() => setPending(null)}
        onConfirm={() => { pending?.onConfirm(); setPending(null); }}
      />

      {createOpen && <CreateFirmDialog onClose={() => setCreateOpen(false)} />}
      {members && <FirmMembersDrawer firm={members} onClose={() => setMembers(null)} />}
    </div>
  );
}

const ROLE_HELP: Record<FirmRole, string> = {
  firm_admin: 'full firm authority; auto-access to every managed tenant',
  firm_staff: 'works assigned tenants; authors firm rules',
  firm_readonly: 'observes firm rules only',
};

function FirmMembersDrawer({ firm, onClose }: { firm: AdminFirmSummary; onClose: () => void }) {
  const toast = useToast();
  const { data, isLoading } = useFirmUsers(firm.id);
  const invite = useInviteFirmUser(firm.id);
  const updateMember = useUpdateFirmUser(firm.id);
  const removeMember = useRemoveFirmUser(firm.id);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<FirmRole>('firm_staff');
  const [removeTarget, setRemoveTarget] = useState<{ id: string; email: string } | null>(null);

  const add = () => {
    invite.mutate({ email: email.trim(), firmRole: role }, {
      onSuccess: () => { toast.success('Member added'); setEmail(''); },
      onError: (e) => toast.error('Could not add member', { detail: (e as Error).message }),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="dialog" aria-modal="true" aria-label={`Members of ${firm.name}`}>
      <div className="h-full w-full max-w-lg bg-white shadow-xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{firm.name}</h2>
            <p className="text-xs text-gray-500">Members · {firm.memberCount} active</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="px-5 py-4 border-b border-gray-200 space-y-2">
          <p className="text-xs text-gray-500">Add an existing user by email. The user must already have an account.</p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@firm.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as FirmRole)} className="rounded-lg border border-gray-300 px-2 py-2 text-sm">
                <option value="firm_admin">firm_admin</option>
                <option value="firm_staff">firm_staff</option>
                <option value="firm_readonly">firm_readonly</option>
              </select>
            </div>
            <Button onClick={add} loading={invite.isPending} disabled={!/\S+@\S+\.\S+/.test(email.trim())}>Add</Button>
          </div>
          <p className="text-[11px] text-gray-500">{role}: {ROLE_HELP[role]}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <LoadingSpinner className="py-8" />
          ) : (data?.users ?? []).length === 0 ? (
            <p className="p-5 text-sm text-gray-500 italic">No members yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                <tr><th className="px-4 py-2">Email</th><th className="px-4 py-2">Role</th><th className="px-4 py-2">Status</th><th className="px-4 py-2" /></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.users ?? []).map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2 text-gray-900">{u.email}<div className="text-xs text-gray-500">{u.displayName ?? ''}</div></td>
                    <td className="px-4 py-2">
                      <select
                        value={u.firmRole}
                        onChange={(e) => updateMember.mutate({ firmUserId: u.id, patch: { firmRole: e.target.value as FirmRole } }, {
                          onError: (err) => toast.error('Could not change role', { detail: (err as Error).message }),
                        })}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value="firm_admin">firm_admin</option>
                        <option value="firm_staff">firm_staff</option>
                        <option value="firm_readonly">firm_readonly</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => updateMember.mutate({ firmUserId: u.id, patch: { isActive: !u.isActive } })}
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                      >
                        {u.isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button type="button" onClick={() => setRemoveTarget({ id: u.id, email: u.email })} className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${u.email}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 text-xs text-gray-500">
          Per-tenant access for staff is edited on the firm&apos;s{' '}
          <Link to={`/firm/${firm.id}/staff`} className="text-primary-700 hover:text-primary-800 font-medium">Staff page</Link>.
        </div>
      </div>

      <ConfirmDialog
        open={!!removeTarget}
        title="Remove member?"
        message={removeTarget ? `${removeTarget.email} will be removed from ${firm.name}. Their existing per-tenant access is not changed.` : ''}
        confirmLabel="Remove"
        variant="danger"
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => { if (removeTarget) removeMember.mutate(removeTarget.id); setRemoveTarget(null); }}
      />
    </div>
  );
}
