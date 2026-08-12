// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// "Invite client to connect" modal (BANK_CONNECT_INVITES_V1): staff enter a
// recipient and the server emails/SMSes a tokenized /connect/:token link
// that runs Plaid Link with no login. Requires email or phone (or both);
// the SMS channel is validated server-side (practice outbound switch +
// STOP list) and fails loud when it was the only channel.

import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toaster';
import { useCreateBankConnectInvite } from '../../api/hooks/useBankConnectInvites';

export function InviteClientModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const create = useCreateBankConnectInvite();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');

  const send = () => {
    create.mutate({
      recipientName: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      message: message.trim() || undefined,
    }, {
      onSuccess: (res) => {
        toast.success(`Invite sent via ${res.channels.join(' + ') || 'no channel — check SMTP/SMS settings'}.`);
        onClose();
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not send the invite.'),
    });
  };

  const canSend = name.trim().length > 0 && (email.trim().length > 0 || phone.trim().length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-label="Invite client to connect a bank">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <h2 className="text-lg font-semibold">Invite client to connect a bank</h2>
        <p className="text-xs text-gray-500">
          The client gets a secure link (valid 7 days) that walks them through connecting their bank
          via Plaid — no MyBooks login needed. One link works for multiple banks. You'll be emailed
          when they connect so you can map the accounts.
        </p>
        <Input label="Client name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" required />
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
        <Input label="Mobile phone (SMS)" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Personal note (email only, optional)</label>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2}
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={create.isPending}>Cancel</Button>
          <Button onClick={send} disabled={!canSend} loading={create.isPending}>Send invite</Button>
        </div>
      </div>
    </div>
  );
}
