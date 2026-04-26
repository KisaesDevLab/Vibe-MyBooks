// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Trash2, UserPlus } from 'lucide-react';
import type { FirmRole } from '@kis-books/shared';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import {
  useFirm,
  useFirmUsers,
  useInviteFirmUser,
  useRemoveFirmUser,
  useUpdateFirmUser,
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
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Display name</th>
                <th className="px-3 py-2">Firm role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 w-16" />
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
