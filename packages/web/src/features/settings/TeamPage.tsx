// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useMe } from '../../api/hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { UserPlus, Power, Copy, CheckCircle } from 'lucide-react';

interface TeamUser {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export function TeamPage() {
  const { data: meData } = useMe();
  const isOwner = meData?.user?.role === 'owner';
  const queryClient = useQueryClient();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('accountant');
  const [tempPassword, setTempPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<TeamUser | null>(null);

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
    mutationFn: (input: { email: string; displayName: string; role: string }) =>
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
    inviteUser.mutate({ email: inviteEmail, displayName: inviteName, role: inviteRole });
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
          <Button onClick={() => { setShowInvite(true); setTempPassword(''); }}>
            <UserPlus className="h-4 w-4 mr-1" /> Invite User
          </Button>
        )}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget && !tempPassword) setShowInvite(false); }}
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
                  <Input label="Email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} type="email" required />
                  <Input label="Display Name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} required />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                      <option value="accountant">Accountant</option>
                      <option value="bookkeeper">Bookkeeper</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Both roles have full access to all data. The label is for identification only.</p>
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
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
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
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-red-400'}`} />
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-4 py-3 text-center">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
