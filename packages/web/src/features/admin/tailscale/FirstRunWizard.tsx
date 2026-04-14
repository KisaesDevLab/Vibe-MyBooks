import { useState } from 'react';
import type { TailscaleStatus } from '@kis-books/shared';
import { KeyRound, ExternalLink } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useTailscaleConnect } from '../../../api/hooks/useTailscale';

export function FirstRunWizard({ status }: { status: TailscaleStatus }) {
  const [authKey, setAuthKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const connect = useTailscaleConnect();

  const submit = () => {
    setError(null);
    connect.mutate(
      { authKey: authKey.trim() || undefined },
      {
        onError: (err: unknown) => {
          setError((err as Error).message || 'Failed to connect');
        },
      },
    );
  };

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
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                label="Auth key"
                value={authKey}
                onChange={(e) => setAuthKey(e.target.value)}
                placeholder="tskey-auth-..."
              />
            </div>
            <Button onClick={submit} loading={connect.isPending} disabled={!authKey.trim()}>
              Pair
            </Button>
          </div>
          {error && (
            <div className="mt-2 text-sm text-red-600">{error}</div>
          )}
        </div>
      </div>
    </div>
  );
}
