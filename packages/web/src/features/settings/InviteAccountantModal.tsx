// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// "Invite my accountant": the owner enters a firm staffer's email. The
// staffer gets an email with a one-click accept link AND an 8-character
// code (Firm → Join a client), valid 14 days. Accepting links this
// company to their firm and gives them accountant access.

import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toaster';
import { isApiError } from '../../api/client';
import { useCreateFirmInvite } from '../../api/hooks/useFirmInvites';

export function InviteAccountantModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const create = useCreateFirmInvite();
  const [email, setEmail] = useState('');

  const send = () => {
    create.mutate({ email: email.trim() }, {
      onSuccess: (res) => {
        if (res.sent) {
          toast.success(res.resent ? 'Invitation re-sent with a fresh link and code.' : 'Invitation sent.');
        } else {
          toast.error('Invitation saved, but the email could not be sent. Check SMTP settings and use Resend.', {
            detail: res.error,
          });
        }
        onClose();
      },
      onError: (err) => {
        const msg = isApiError(err) && err.code === 'CANNOT_INVITE_SELF'
          ? "That's your own address — enter your accountant's email."
          : err instanceof Error ? err.message : 'Could not send the invitation.';
        toast.error(msg);
      },
    });
  };

  const canSend = /\S+@\S+\.\S+/.test(email.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" role="dialog" aria-modal="true" aria-label="Invite your accountant">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Invite your accountant</h2>
        <p className="text-xs text-gray-500">
          Your accountant gets an email with a link and an 8-character code, valid for 14 days. They
          must already have a MyBooks account that belongs to an accounting firm. When they accept,
          your books are linked to their firm and they get accountant access.
        </p>
        <Input
          label="Accountant's email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="pat@yourcpafirm.com"
          autoFocus
          required
        />
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button onClick={send} loading={create.isPending} disabled={!canSend}>Send invitation</Button>
        </div>
      </div>
    </div>
  );
}
