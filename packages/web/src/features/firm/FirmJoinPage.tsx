// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Firm → Join a client: type the 8-character code from a client's
// "invite your accountant" email. Same accept flow as the emailed link.

import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { FirmInviteAcceptCard } from './FirmInviteAcceptCard';

const CODE_RE = /^[A-Z2-9]{8}$/;

export function FirmJoinPage() {
  const [raw, setRaw] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);
  const code = raw.replace(/[^a-z0-9]/gi, '').toUpperCase();
  const valid = CODE_RE.test(code);

  return (
    <div className="max-w-xl mx-auto flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900">Join a client</h1>
        <p className="text-sm text-gray-500">
          A client who invited you to be their accountant received an 8-character code by email.
          Enter it here to link their books to your firm.
        </p>
      </header>

      <form
        className="rounded-lg border border-gray-200 bg-white p-5 flex items-end gap-3"
        onSubmit={(e) => { e.preventDefault(); if (valid) setSubmitted(code); }}
      >
        <div className="flex-1">
          <label htmlFor="join-code" className="block text-sm font-medium text-gray-700 mb-1">Invitation code</label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              id="join-code"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="ABCD2345"
              autoComplete="off"
              spellCheck={false}
              maxLength={12}
              className="block w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 font-mono text-lg tracking-[0.3em] uppercase"
            />
          </div>
        </div>
        <Button type="submit" disabled={!valid}>Look up</Button>
      </form>

      {submitted && <FirmInviteAcceptCard lookup={{ code: submitted }} />}
    </div>
  );
}
