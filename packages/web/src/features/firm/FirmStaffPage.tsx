// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { KeyRound, Trash2, UserPlus } from 'lucide-react';
import type { FirmRole, FirmUserWithProfile, TenantAccessRole } from '@kis-books/shared';
import { TENANT_ACCESS_ROLES } from '@kis-books/shared';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import {
  useFirm,
  useFirmUsers,
  useInviteFirmUser,
  useRemoveFirmUser,
  useUpdateFirmUser,
  useStaffTenantAccess,
  useSetStaffTenantAccess,
} from '../../api/hooks/useFirms';
import { FirmTabs } from './FirmTabs';

// 3-tier rules plan, Phase 1 — firm staff management. firm_admin
// invites by email or userId, edits role, soft-removes membership.
// Loose `userId` reference (no FK to users) means an invitee must
// already exist in the kis-books users table; the route's invite
// service surfaces a 404 otherwise.
export function FirmStaffPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const firm = useFirm(firmId ?? null);
  const { data, isLoading } = useFirmUsers(firmId ?? null);
  const invite = useInviteFirmUser(firmId ?? '');
  const update = useUpdateFirmUser(firmId ?? '');
  const remove = useRemoveFirmUser(firmId ?? '');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [accessTarget, setAccessTarget] = useState<FirmUserWithProfile | null>(null);

  if (!firmId) return null;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">{firm.data?.name ?? 'Firm'}</h1>
        <FirmTabs firmId={firmId} active="staff" />
      </header>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Staff</h2>
          <p className="text-xs text-gray-500">
            Firm-internal roles. Independent of per-tenant access.
          </p>
        </div>
        <Button variant="primary" onClick={() => setInviteOpen(true)}>
          <UserPlus className="h-4 w-4 mr-1" />
          Invite staff
        </Button>
      </div>

      {isLoading ? (
        <LoadingSpinner size="md" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Display name</th>
                <th className="px-3 py-2">Firm role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.users ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-gray-500 italic py-8">
                    No staff yet. Click &quot;Invite staff&quot; to add the first member.
                  </td>
                </tr>
              )}
              {(data?.users ?? []).map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-2 text-gray-900">{u.email}</td>
                  <td className="px-3 py-2 text-gray-600">{u.displayName ?? '—'}</td>
                  <td className="px-3 py-2">
                    <select
                      value={u.firmRole}
                      onChange={(e) =>
                        update.mutate({
                          firmUserId: u.id,
                          patch: { firmRole: e.target.value as FirmRole },
                        })
                      }
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
                    >
                      <option value="firm_admin">firm_admin</option>
                      <option value="firm_staff">firm_staff</option>
                      <option value="firm_readonly">firm_readonly</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        update.mutate({
                          firmUserId: u.id,
                          patch: { isActive: !u.isActive },
                        })
                      }
                      className={
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ' +
                        (u.isActive
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-100 text-gray-500')
                      }
                    >
                      {u.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setAccessTarget(u)}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        title="Grant access to the firm's client tenants"
                      >
                        <KeyRound className="h-3.5 w-3.5" /> Tenant access
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Remove ${u.email} from this firm?`)) {
                            remove.mutate(u.id);
                          }
                        }}
                        aria-label={`Remove ${u.email}`}
                        className="rounded p-1 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {inviteOpen && (
        <InviteStaffDialog
          onSubmit={async (input) => {
            await invite.mutateAsync(input);
            setInviteOpen(false);
          }}
          onClose={() => setInviteOpen(false)}
          isPending={invite.isPending}
        />
      )}

      {accessTarget && (
        <StaffTenantAccessDialog
          firmId={firmId}
          firmUser={accessTarget}
          onClose={() => setAccessTarget(null)}
        />
      )}
    </div>
  );
}

// Grant/revoke a staffer's access across the firm's managed tenants in one
// place. Each row is a client tenant; check it to grant access with the chosen
// role, uncheck to revoke. The set is authoritative for the firm's tenants
// only — the server never touches the user's direct (non-firm) access.
function StaffTenantAccessDialog({
  firmId,
  firmUser,
  onClose,
}: {
  firmId: string;
  firmUser: FirmUserWithProfile;
  onClose: () => void;
}) {
  const { data, isLoading } = useStaffTenantAccess(firmId, firmUser.id);
  const save = useSetStaffTenantAccess(firmId);
  const [error, setError] = useState<string | null>(null);

  // Local editable state: tenantId → { checked, role }. Seeded from the server
  // rows once they arrive (a granted tenant defaults to 'accountant' display,
  // but keeps its real role).
  const [draft, setDraft] = useState<Record<string, { checked: boolean; role: TenantAccessRole }>>({});
  useEffect(() => {
    if (!data?.access) return;
    const next: Record<string, { checked: boolean; role: TenantAccessRole }> = {};
    for (const row of data.access) {
      next[row.tenantId] = { checked: row.hasAccess, role: (row.role ?? 'accountant') as TenantAccessRole };
    }
    setDraft(next);
  }, [data]);

  const rows = data?.access ?? [];

  const submit = async () => {
    setError(null);
    const access = rows
      .filter((r) => draft[r.tenantId]?.checked)
      .map((r) => ({ tenantId: r.tenantId, role: draft[r.tenantId]!.role }));
    try {
      await save.mutateAsync({ firmUserId: firmUser.id, access });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save tenant access');
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col gap-3 p-5" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Tenant access</h2>
          <p className="text-xs text-gray-500">
            {firmUser.displayName ? `${firmUser.displayName} · ` : ''}{firmUser.email}. Grant access to the firm&apos;s client tenants and pick a role for each.
          </p>
        </div>

        {isLoading ? (
          <LoadingSpinner size="md" />
        ) : rows.length === 0 ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This firm has no active managed tenants yet. Assign client tenants to the firm first (Tenants tab), then grant access here.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto rounded-md border border-gray-200 divide-y divide-gray-100">
            {rows.map((r) => {
              const d = draft[r.tenantId] ?? { checked: r.hasAccess, role: 'accountant' as TenantAccessRole };
              return (
                <div key={r.tenantId} className="flex items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={d.checked}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [r.tenantId]: { ...d, checked: e.target.checked } }))}
                    className="h-4 w-4 rounded border-gray-300"
                    aria-label={`Grant access to ${r.tenantName}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-gray-900">{r.tenantName}</div>
                    <div className="truncate font-mono text-[11px] text-gray-500">{r.tenantSlug}</div>
                  </div>
                  <select
                    value={d.role}
                    disabled={!d.checked}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [r.tenantId]: { ...d, role: e.target.value as TenantAccessRole } }))}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    {TENANT_ACCESS_ROLES.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}

        {error && <p className="text-xs text-rose-700">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={isLoading || save.isPending || rows.length === 0}>
            {save.isPending ? 'Saving…' : 'Save access'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function InviteStaffDialog({
  onSubmit,
  onClose,
  isPending,
}: {
  onSubmit: (input: { email: string; firmRole: FirmRole }) => Promise<void>;
  onClose: () => void;
  isPending: boolean;
}) {
  const [email, setEmail] = useState('');
  const [firmRole, setFirmRole] = useState<FirmRole>('firm_staff');
  const [error, setError] = useState<string | null>(null);

  const handle = async () => {
    setError(null);
    try {
      await onSubmit({ email: email.trim(), firmRole });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invite failed');
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900">Invite staff</h2>
        <p className="text-xs text-gray-500">
          The invitee must already have a kis-books account.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-700">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
            placeholder="cpa@example.com"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-700">Firm role</span>
          <select
            value={firmRole}
            onChange={(e) => setFirmRole(e.target.value as FirmRole)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="firm_admin">firm_admin — full firm authority</option>
            <option value="firm_staff">firm_staff — author tenant_firm rules</option>
            <option value="firm_readonly">firm_readonly — observe firm rules</option>
          </select>
        </label>
        {error && <p className="text-xs text-rose-700">{error}</p>}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handle} disabled={isPending || !email.trim()}>
            {isPending ? 'Inviting…' : 'Invite'}
          </Button>
        </div>
      </div>
    </div>
  );
}
