// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toaster';
import { useChangePassword } from '../../api/hooks/useAuth';

export function ChangePasswordSection() {
  const toast = useToast();
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) { setError('New passwords do not match'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError('');
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          toast.success('Password changed', { detail: 'Other devices have been signed out.' });
          setCurrentPassword('');
          setNewPassword('');
          setConfirm('');
        },
        onError: (err) => setError((err as Error).message || 'Failed to change password'),
      },
    );
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-gray-500" />
        <h3 className="font-medium text-gray-900">Password</h3>
      </div>
      <p className="text-xs text-gray-500">
        Changing your password signs you out on every other device.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
        <Input
          label="Current Password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <Input
          label="New Password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
        <Input
          label="Confirm New Password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" loading={changePassword.isPending}>Change Password</Button>
      </form>
    </div>
  );
}
