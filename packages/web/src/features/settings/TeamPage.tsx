// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, startImpersonation } from '../../api/client';
import { useMe } from '../../api/hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toaster';
import { TemplatesModal, UserPermissionsModal } from './TeamPermissionModals';
import { UserPlus, Copy, CheckCircle, ShieldCheck, SlidersHorizontal, Eye } from 'lucide-react';

interface TeamUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  userType?: 'staff' | 'client';
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

// Bookkeepers and every external (client) user can have their access
// tailored via a permission template + overrides. Mirrors
// isCustomizablePrincipal on the backend.
function canManagePermissions(u: TeamUser): boolean {
  return u.role === 'bookkeeper' || u.userType === 'client';
}

export function TeamPage() {
  const { data: meData } = useMe();
  // Super admins can manage users/permissions on any tenant, whether or not
  // they hold the tenant's owner role (mirrors the backend owner-gate bypass).
  const isOwner = meData?.user?.role === 'owner'
    || !!(meData?.user as { isSuperAdmin?: boolean } | undefined)?.isSuperAdmin;
  const isSuperAdmin = !!(meData?.user as { isSuperAdmin?: boolean } | undefined)?.isSuperAdmin;
  const currentUserId = meData?.user?.id;
  const toast = useToast();
  const queryClient = useQueryClient();

  // Super-admin "View as": swap to a short-lived token in the target user's
  // context (NOT super-admin) so the app shows exactly what they can access,
  // then reload. The banner (ImpersonationBanner) offers "Return".
  const impersonate = async (u: TeamUser) => {
    try {
      const res = await apiClient<{ accessToken: string }>(`/admin/impersonate/${u.id}`, { method: 'POST' });
      startImpersonation(res.accessToken, { id: u.id, name: u.displayName || u.email });
      window.location.assign('/');
    } catch (e) {
      toast.error('Could not view as this user', { detail: (e as Error).message });
    }
  };
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('accountant');
  const [inviteUserType, setInviteUserType] = useState<'staff' | 'client'>('staff');
  const [tempPassword, setTempPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<TeamUser | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [permTarget, setPermTarget] = useState<TeamUser | null>(null);

  // Escape closes the invite dialog — but only before the temp password
  // has been generated. Once we're on the "User Invited" confirmation
  // screen the caller should dismiss explicitly via the Done button so
  // the temp password doesn't flicker away before they can copy it.
  useEffect(() => {
    if (!showInvite || tempPassword) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowInvite(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showInvite, tempPassword]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['company', 'users'],
    queryFn: () => apiClient<{ users: TeamUser[] }>('/company/users'),
  });

  const inviteUser = useMutation({
    mutationFn: (input: { email: string; displayName: string; role: string; userType: 'staff' | 'client' }) =>
      apiClient<{ user: TeamUser; temporaryPassword: string | null; existingUser: boolean; message: string }>('/company/invite-user', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['company', 'users'] });
      if (result.temporaryPassword) {
        setTempPassword(result.temporaryPassword);
      } else {
        // Existing user — no temp password needed
        setTempPassword('');
        setShowInvite(false);
      }
      setInviteEmail('');
      setInviteName('');
    },
  });

  const deactivateUser = useMutation({
    mutationFn: (userId: string) =>
      apiClient(`/company/users/${userId}/deactivate`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', 'users'] }),
  });

  const reactivateUser = useMutation({
    mutationFn: (userId: string) =>
      apiClient(`/company/users/${userId}/reactivate`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', 'users'] }),
  });

  const handleInvite = () => {
    if (!inviteEmail || !inviteName) return;
    inviteUser.mutate({ email: inviteEmail, displayName: inviteName, role: inviteRole, userType: inviteUserType });
  };

  // Switching to an external user resets the role to a view-only baseline
  // (the owner then grants specific access via a permission template);
  // switching back to internal restores the default staff role.
  const handleUserTypeChange = (next: 'staff' | 'client') => {
    setInviteUserType(next);
    setInviteRole(next === 'client' ? 'readonly' : 'accountant');
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError) return <ErrorMessage onRetry={() => refetch()} />;

  const users = data?.users || [];

  return (
    <div>
      <ConfirmDialog
        open={!!deactivateTarget}
        title="Deactivate team member?"
        message={deactivateTarget ? `${deactivateTarget.email} will lose access until reactivated.` : ''}
        confirmLabel="Deactivate"
        variant="danger"
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={() => {
          if (deactivateTarget) deactivateUser.mutate(deactivateTarget.id);
          setDeactivateTarget(null);
        }}
      />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500 mt-1">Manage users who have access to your books.</p>
        </div>
        {isOwner && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowTemplates(true)}>
              <ShieldCheck className="h-4 w-4 mr-1" /> Permission Templates
            </Button>
            <Button onClick={() => { setShowInvite(true); setTempPassword(''); handleUserTypeChange('staff'); }}>
              <UserPlus className="h-4 w-4 mr-1" /> Invite User
            </Button>
          </div>
        )}
      </div>

      {showTemplates && <TemplatesModal onClose={() => setShowTemplates(false)} />}
      {permTarget && (
        <UserPermissionsModal
          userId={permTarget.id}
          email={permTarget.email}
          onClose={() => setPermTarget(null)}
        />
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="Invite user"
        >
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            {tempPassword ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">User Invited</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Share these credentials with the user. The temporary password should be changed on first login.
                </p>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                  <div><span className="text-gray-500">Email:</span> <strong>{inviteUser.data?.user.email}</strong></div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Password:</span>
                    <code className="bg-gray-200 px-2 py-0.5 rounded font-mono">{tempPassword}</code>
                    <button onClick={handleCopyPassword} className="text-gray-400 hover:text-primary-600">
                      {copied ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button onClick={() => { setShowInvite(false); setTempPassword(''); }}>Done</Button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Invite User</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">User type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleUserTypeChange('staff')}
                        className={`rounded-lg border px-3 py-2 text-left text-sm ${
                          inviteUserType === 'staff'
                            ? 'border-primary-500 bg-primary-50 text-primary-800'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium">Internal</div>
                        <div className="text-xs text-gray-500">Your team / firm staff</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUserTypeChange('client')}
                        className={`rounded-lg border px-3 py-2 text-left text-sm ${
                          inviteUserType === 'client'
                            ? 'border-primary-500 bg-primary-50 text-primary-800'
                            : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium">External</div>
                        <div className="text-xs text-gray-500">Outside collaborator / client</div>
                      </button>
                    </div>
                  </div>
                  <Input label="Email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} type="email" required />
                  <Input label="Display Name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} required />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                      <option value="accountant">Accountant</option>
                      <option value="bookkeeper">Bookkeeper</option>
                      <option value="readonly">Read-only</option>
                    </select>
                    {inviteUserType === 'client' ? (
                      <p className="text-xs text-gray-500 mt-1">
                        External users start view-only. After inviting, click <strong>Permissions</strong> on
                        their row to grant exactly what they can see and do.
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">
                        Accountant has full access. Bookkeeper defaults to full access but can be restricted via
                        Permissions. Read-only can view but not change data.
                      </p>
                    )}
                  </div>
                </div>
                {inviteUser.error && <p className="text-sm text-red-600 mt-3">{inviteUser.error.message}</p>}
                <div className="flex justify-end gap-3 mt-4">
                  <Button variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button>
                  <Button onClick={handleInvite} loading={inviteUser.isPending} disabled={!inviteEmail || !inviteName}>Invite</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Last Login</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.displayName || '—'}</td>
                <td className="px-4 py-3 text-gray-700">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    u.role === 'owner' ? 'bg-blue-100 text-blue-700' :
                    u.role === 'accountant' ? 'bg-purple-100 text-purple-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>{u.role}</span>
                  {u.userType === 'client' && (
                    <span className="ml-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">External</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-red-400'}`} />
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="inline-flex items-center gap-3">
                    {isSuperAdmin && u.id !== currentUserId && u.isActive && (
                      <button
                        onClick={() => impersonate(u)}
                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                        title="View the app as this user to check their permissions"
                      >
                        <Eye className="h-3.5 w-3.5" /> View as
                      </button>
                    )}
                    {isOwner && canManagePermissions(u) && (
                      <button
                        onClick={() => setPermTarget(u)}
                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
                        title="Manage permissions"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5" /> Permissions
                      </button>
                    )}
                    {u.role !== 'owner' && (
                      u.isActive ? (
                        <button
                          onClick={() => setDeactivateTarget(u)}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => reactivateUser.mutate(u.id)}
                          className="text-xs text-green-600 hover:text-green-700"
                        >
                          Reactivate
                        </button>
                      )
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
