// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ShieldCheck, AlertTriangle, CheckCircle, KeyRound, RefreshCw, Trash2 } from 'lucide-react';

interface SecurityStatus {
  sentinelExists: boolean;
  sentinelHeader: {
    installationId: string;
    hostId: string;
    createdAt: string;
    adminEmail: string;
    appVersion: string;
  } | null;
  recoveryFileExists: boolean;
  recoveryFileStale: boolean;
  staleFields: string[];
  dbInstallationId: string | null;
}

interface RegenerateResponse {
  success: boolean;
  recoveryKey: string;
  message: string;
}

/**
 * Super-admin page for inspecting and rotating installation integrity state.
 * Lives at /admin/security and is mounted alongside the other admin pages.
 * Every destructive action requires the caller's current password — stale
 * session tokens must not be sufficient to rotate the installation ID.
 */
export function InstallationSecurityPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<SecurityStatus>({
    queryKey: ['admin', 'security-status'],
    queryFn: () => apiClient<SecurityStatus>('/admin/security/status'),
  });

  // Shared state for each action's password prompt. Only one modal active
  // at a time, so we can reuse one piece of state across all four flows.
  const [actionInFlight, setActionInFlight] = useState<null | 'regen' | 'rotate' | 'delete' | 'refresh'>(null);
  const [password, setPassword] = useState('');
  const [refreshRecoveryKey, setRefreshRecoveryKey] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [newRecoveryKey, setNewRecoveryKey] = useState<string | null>(null);
  const [refreshSuccess, setRefreshSuccess] = useState<string | null>(null);

  // Test recovery key state
  const [testKey, setTestKey] = useState('');
  const [testResult, setTestResult] = useState<null | { valid: true; createdAt?: string } | { valid: false; message: string }>(null);

  const reset = () => {
    setActionInFlight(null);
    setPassword('');
    setRefreshRecoveryKey('');
    setActionError(null);
  };

  async function runRefresh() {
    setActionError(null);
    try {
      const res = await apiClient<{ success: boolean; message: string }>(
        '/admin/security/recovery-file/refresh',
        {
          method: 'POST',
          body: JSON.stringify({ password, recoveryKey: refreshRecoveryKey }),
        },
      );
      setRefreshSuccess(res.message);
      reset();
      queryClient.invalidateQueries({ queryKey: ['admin', 'security-status'] });
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function runRegenerate() {
    setActionError(null);
    try {
      const res = await apiClient<RegenerateResponse>('/admin/security/recovery-key/regenerate', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setNewRecoveryKey(res.recoveryKey);
      reset();
      queryClient.invalidateQueries({ queryKey: ['admin', 'security-status'] });
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function runRotate() {
    setActionError(null);
    try {
      const res = await apiClient<RegenerateResponse>('/admin/security/installation-id/rotate', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setNewRecoveryKey(res.recoveryKey);
      reset();
      queryClient.invalidateQueries({ queryKey: ['admin', 'security-status'] });
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function runDelete() {
    setActionError(null);
    try {
      await apiClient('/admin/security/recovery-key', {
        method: 'DELETE',
        body: JSON.stringify({ password }),
      });
      reset();
      queryClient.invalidateQueries({ queryKey: ['admin', 'security-status'] });
    } catch (err) {
      setActionError((err as Error).message);
    }
  }

  async function runTest() {
    setTestResult(null);
    try {
      const res = await apiClient<{ valid: boolean; createdAt?: string }>(
        '/admin/security/recovery-key/test',
        {
          method: 'POST',
          body: JSON.stringify({ recoveryKey: testKey }),
        },
      );
      if (res.valid) {
        setTestResult({ valid: true, createdAt: res.createdAt });
      } else {
        setTestResult({ valid: false, message: 'Key rejected' });
      }
    } catch (err) {
      setTestResult({ valid: false, message: (err as Error).message });
    }
  }

  if (isLoading) return <LoadingSpinner />;
  if (!data) return <p>Failed to load security status.</p>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-blue-600" /> Installation Security
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Inspect and rotate the sentinel and recovery key for this installation.
        </p>
      </div>

      {/* Status panel */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold">Current state</h2>
        <dl className="text-sm grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 font-mono">
          <dt className="text-gray-500">Sentinel file:</dt>
          <dd>
            {data.sentinelExists ? (
              <span className="inline-flex items-center gap-1 text-green-700">
                <CheckCircle className="h-4 w-4" /> present
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-red-700">
                <AlertTriangle className="h-4 w-4" /> missing
              </span>
            )}
          </dd>
          <dt className="text-gray-500">Recovery file:</dt>
          <dd>
            {data.recoveryFileExists ? (
              <span className="inline-flex items-center gap-1 text-green-700">
                <CheckCircle className="h-4 w-4" /> present
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <AlertTriangle className="h-4 w-4" /> missing
              </span>
            )}
          </dd>
          {data.sentinelHeader && (
            <>
              <dt className="text-gray-500">Installation ID:</dt>
              <dd>{data.sentinelHeader.installationId}</dd>
              <dt className="text-gray-500">Host ID:</dt>
              <dd>{data.sentinelHeader.hostId}</dd>
              <dt className="text-gray-500">Set up on:</dt>
              <dd>{new Date(data.sentinelHeader.createdAt).toLocaleString()}</dd>
              <dt className="text-gray-500">Set up by:</dt>
              <dd>{data.sentinelHeader.adminEmail}</dd>
              <dt className="text-gray-500">App version at setup:</dt>
              <dd>{data.sentinelHeader.appVersion}</dd>
            </>
          )}
          <dt className="text-gray-500">DB installation_id:</dt>
          <dd>{data.dbInstallationId ?? '—'}</dd>
        </dl>

        {data.recoveryFileStale && data.staleFields.length > 0 && (
          <div className="rounded-md bg-red-50 border border-red-300 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-900 text-sm">Recovery file is stale</p>
                <p className="text-sm text-red-800">
                  The sentinel's stored hash for {data.staleFields.join(', ')} no longer matches
                  the live environment. Someone rotated these values without updating the
                  recovery file — if you lose <code>/data/config/.env</code> now, the recovery
                  file will reconstruct an outdated copy.
                </p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => setActionInFlight('refresh')}>
              Refresh recovery file
            </Button>
          </div>
        )}

        {refreshSuccess && (
          <div className="rounded-md bg-green-50 border border-green-300 p-3">
            <p className="text-sm text-green-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" /> {refreshSuccess}
            </p>
          </div>
        )}
      </section>

      {/* New recovery key display */}
      {newRecoveryKey && (
        <section className="rounded-lg border-2 border-amber-400 bg-amber-50 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <KeyRound className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-amber-900">New recovery key — save this now</h3>
              <p className="text-sm text-amber-800">
                The previous recovery key stopped working the moment this key was generated. This
                is the only copy — it will not be shown again.
              </p>
            </div>
          </div>
          <div className="bg-white border border-amber-300 rounded p-4 font-mono text-xl text-center tracking-wider select-all break-all">
            {newRecoveryKey}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigator.clipboard.writeText(newRecoveryKey)}>
              Copy to clipboard
            </Button>
            <Button variant="secondary" onClick={() => setNewRecoveryKey(null)}>
              I have saved it
            </Button>
          </div>
        </section>
      )}

      {/* Actions */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold">Actions</h2>

        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold flex items-center gap-1"><RefreshCw className="h-4 w-4" /> Generate new recovery key</h3>
              <p className="text-sm text-gray-600">
                Rewrites <code>/data/.env.recovery</code>. Old key stops working.
              </p>
            </div>
            <Button onClick={() => setActionInFlight('regen')}>Generate new</Button>
          </div>

          <div className="flex items-start justify-between gap-3 pt-3 border-t border-gray-100">
            <div>
              <h3 className="font-semibold flex items-center gap-1"><KeyRound className="h-4 w-4" /> Rotate installation ID</h3>
              <p className="text-sm text-gray-600">
                Generates a new UUID and regenerates both sentinel and recovery file. Use after a
                suspected compromise or on a compliance schedule.
              </p>
            </div>
            <Button variant="secondary" onClick={() => setActionInFlight('rotate')}>Rotate</Button>
          </div>

          <div className="flex items-start justify-between gap-3 pt-3 border-t border-gray-100">
            <div>
              <h3 className="font-semibold flex items-center gap-1 text-red-700"><Trash2 className="h-4 w-4" /> Delete recovery file</h3>
              <p className="text-sm text-gray-600">
                Removes <code>/data/.env.recovery</code>. Use if you manage your env separately and
                consider the recovery file a liability. Recovery capability is permanently lost
                until you generate a new key.
              </p>
            </div>
            <Button variant="secondary" onClick={() => setActionInFlight('delete')}>Delete</Button>
          </div>
        </div>
      </section>

      {/* Test recovery key */}
      <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
        <h2 className="text-lg font-semibold">Test a recovery key</h2>
        <p className="text-sm text-gray-600">
          Verify a recovery key is still correct without revealing the decrypted values. Use this
          to confirm the paper copy you're keeping actually works.
        </p>
        <Input
          placeholder="RKVMB-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
          value={testKey}
          onChange={(e) => setTestKey(e.target.value)}
          className="font-mono"
        />
        <Button variant="secondary" onClick={runTest} disabled={!testKey}>
          Test key
        </Button>
        {testResult && 'valid' in testResult && testResult.valid ? (
          <p className="text-sm text-green-700 flex items-center gap-1">
            <CheckCircle className="h-4 w-4" /> Key is valid
            {testResult.createdAt && ` — file created ${new Date(testResult.createdAt).toLocaleString()}`}
          </p>
        ) : testResult ? (
          <p className="text-sm text-red-700 flex items-center gap-1">
            <AlertTriangle className="h-4 w-4" /> Key rejected
            {'message' in testResult ? ` — ${testResult.message}` : ''}
          </p>
        ) : null}
      </section>

      {/* Password modal */}
      {actionInFlight && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold">
              {actionInFlight === 'refresh' ? 'Refresh recovery file' : 'Confirm with your password'}
            </h3>
            <p className="text-sm text-gray-600">
              {actionInFlight === 'regen' && 'This will invalidate the current recovery key.'}
              {actionInFlight === 'rotate' && 'This will generate a new installation ID and rewrite the sentinel and recovery file.'}
              {actionInFlight === 'delete' && 'This will delete the recovery file. You will lose recovery capability until a new key is generated.'}
              {actionInFlight === 'refresh' && 'Re-encrypts /data/.env.recovery with the current environment values while keeping your existing recovery key.'}
            </p>
            <Input
              type="password"
              placeholder="Current password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {actionInFlight === 'refresh' && (
              <Input
                type="text"
                placeholder="Current recovery key (RKVMB-XXXXX-…)"
                value={refreshRecoveryKey}
                onChange={(e) => setRefreshRecoveryKey(e.target.value)}
                className="font-mono"
              />
            )}
            {actionError && <p className="text-sm text-red-700">{actionError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={reset}>Cancel</Button>
              <Button
                onClick={() => {
                  if (actionInFlight === 'regen') runRegenerate();
                  else if (actionInFlight === 'rotate') runRotate();
                  else if (actionInFlight === 'delete') runDelete();
                  else if (actionInFlight === 'refresh') runRefresh();
                }}
                disabled={!password || (actionInFlight === 'refresh' && !refreshRecoveryKey)}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
