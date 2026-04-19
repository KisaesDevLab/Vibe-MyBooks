// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import type { TailscaleStatus } from '@kis-books/shared';
import { KeyRound, ExternalLink } from 'lucide-react';
import { AuthKeyPairForm } from './AuthKeyPairForm';

export function FirstRunWizard({ status }: { status: TailscaleStatus }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-amber-600" />
        <h2 className="text-lg font-semibold text-gray-900">Pair This Appliance With Your Tailnet</h2>
      </div>
      <div className="px-6 py-4 space-y-4 text-sm text-gray-700">
        <p>
          Tailscale is not yet paired. Choose one of the following options to join this appliance
          to your tailnet. Remote access URLs become available once pairing completes.
        </p>

        {status.authURL && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="font-medium text-amber-900 mb-1">Option 1 — Pair in browser</div>
            <p className="text-amber-900/80 mb-2">
              Open the link below on any device signed in to your Tailscale account.
            </p>
            <a
              href={status.authURL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-amber-700 hover:text-amber-900 hover:underline break-all"
            >
              {status.authURL} <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
            </a>
          </div>
        )}

        <div className="border border-gray-200 rounded-lg p-4">
          <div className="font-medium text-gray-900 mb-1">
            Option {status.authURL ? '2' : '1'} — Auth key
          </div>
          <p className="text-gray-600 mb-3">
            Generate a reusable auth key at{' '}
            <a
              href="https://login.tailscale.com/admin/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline"
            >
              login.tailscale.com
            </a>{' '}
            and paste it below.
          </p>
          <AuthKeyPairForm />
        </div>
      </div>
    </div>
  );
}
