// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { useTailscaleConnect } from '../../../api/hooks/useTailscale';

interface AuthKeyPairFormProps {
  // When `true`, also attempt a no-key connect (kicks /login-interactive so
  // tailscaled produces a fresh AuthURL on /status). Use this from the
  // error-fallback path where we have no status to work with.
  allowNoKey?: boolean;
}

export function AuthKeyPairForm({ allowNoKey = false }: AuthKeyPairFormProps) {
  const [authKey, setAuthKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const connect = useTailscaleConnect();

  const submit = (withKey: boolean) => {
    setError(null);
    setSuccess(null);
    connect.mutate(
      { authKey: withKey ? authKey.trim() : undefined },
      {
        onSuccess: (result) => {
          setSuccess(result.message);
          if (withKey) setAuthKey('');
        },
        onError: (err: unknown) => {
          setError((err as Error).message || 'Failed to contact the Tailscale sidecar');
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            label="Auth key"
            value={authKey}
            onChange={(e) => setAuthKey(e.target.value)}
            placeholder="tskey-auth-..."
          />
        </div>
        <Button
          onClick={() => submit(true)}
          loading={connect.isPending}
          disabled={!authKey.trim()}
        >
          Pair
        </Button>
      </div>
      {allowNoKey && (
        <div className="text-xs text-gray-600">
          No key handy?{' '}
          <button
            type="button"
            className="text-primary-600 hover:underline disabled:opacity-50"
            onClick={() => submit(false)}
            disabled={connect.isPending}
          >
            Request a browser auth URL
          </button>{' '}
          — the sidecar will print a one-time login link you can open in any
          browser signed into your Tailscale account.
        </div>
      )}
      {success && <div className="text-sm text-green-700">{success}</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}
