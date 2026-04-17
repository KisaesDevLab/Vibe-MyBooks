// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect, type FormEvent } from 'react';
import { DiagnosticFrame } from './DiagnosticFrame';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type { SentinelHeaderDTO } from './types';

interface EnvStatus {
  state: 'env-missing';
  missingVars: string[];
  sentinelHeader: SentinelHeaderDTO | null;
  sentinelHeaderError: string | null;
  hostId: string | null;
  recoveryFilePresent: boolean;
}

/**
 * Rendered when the API is running in env-missing recovery mode. The
 * bootstrap entrypoint detected that one or more required env vars
 * (DATABASE_URL / JWT_SECRET / ENCRYPTION_KEY) are absent and started the
 * minimal `env-missing-app` Express server instead of the normal API.
 *
 * Two flows:
 *   1. If /data/.env.recovery exists, offer the recovery-key input so the
 *      operator can rebuild /data/config/.env from their 25-char key.
 *   2. Otherwise, show manual recovery guidance — there is nothing an
 *      operator can do from the UI alone.
 *
 * F22 resilience: if the operator closes the tab mid-flow, the next page
 * load re-fetches status and re-renders from scratch. Nothing is held
 * in browser session state.
 */
export function EnvMissingPage() {
  const [status, setStatus] = useState<EnvStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [key, setKey] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/diagnostic/env-status', { cache: 'no-store' });
        if (!res.ok) throw new Error(`status endpoint returned ${res.status}`);
        const body = (await res.json()) as EnvStatus;
        if (!cancelled) setStatus(body);
      } catch (err) {
        if (!cancelled) setFetchError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/diagnostic/env-recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryKey: key }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error?.message ?? 'recovery failed');
      }
      setSuccess(body.message ?? 'Configuration recovered. Restart the API container.');
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <DiagnosticFrame title="Environment Configuration Missing" code="ENV_MISSING">
        <p className="text-slate-300">Checking sentinel state…</p>
      </DiagnosticFrame>
    );
  }

  if (fetchError || !status) {
    return (
      <DiagnosticFrame title="Environment Configuration Missing" code="ENV_MISSING">
        <div className="rounded-md bg-slate-900 border border-slate-700 p-4">
          <p>The diagnostic endpoint is unreachable.</p>
          <p className="mt-2 text-xs text-slate-500 font-mono">{fetchError}</p>
        </div>
      </DiagnosticFrame>
    );
  }

  const header = status.sentinelHeader;

  return (
    <DiagnosticFrame title="Environment Configuration Missing" code="ENV_MISSING">
      <div className="rounded-md bg-slate-900 border border-slate-700 p-4 space-y-2">
        <p>
          The API container started but one or more required environment variables are not set:
        </p>
        <ul className="list-disc list-inside text-sm font-mono text-red-300">
          {status.missingVars.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
        {header ? (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-sm text-slate-400">This server was previously configured:</p>
            <dl className="mt-2 text-sm font-mono grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
              <dt className="text-slate-400">Installation ID:</dt>
              <dd>{header.installationId}</dd>
              <dt className="text-slate-400">Set up on:</dt>
              <dd>{new Date(header.createdAt).toLocaleString()}</dd>
              <dt className="text-slate-400">Set up by:</dt>
              <dd>{header.adminEmail}</dd>
            </dl>
          </div>
        ) : (
          <p className="text-sm text-yellow-200 mt-2">
            No sentinel file found — nothing to recover from.
          </p>
        )}
      </div>

      {status.recoveryFilePresent && header ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">Recover with your recovery key</h2>
          <p className="text-sm text-slate-300">
            A recovery file was found at <code className="bg-slate-800 px-1 rounded">/data/.env.recovery</code>.
            Enter the recovery key you saved during setup to rebuild{' '}
            <code className="bg-slate-800 px-1 rounded">/data/config/.env</code>.
          </p>

          {success ? (
            <div className="rounded-md border border-green-700 bg-green-950 p-4">
              <p className="text-green-200 font-semibold">{success}</p>
              <pre className="mt-3 bg-slate-950 p-3 rounded text-xs text-slate-300 overflow-x-auto">
docker compose restart api
              </pre>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="rounded-md border border-slate-700 bg-slate-900 p-4 space-y-3">
              <label className="block">
                <span className="block text-xs uppercase text-slate-400 mb-1">Recovery key</span>
                <Input
                  type="text"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="RKVMB-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                  className="font-mono"
                  autoComplete="off"
                  spellCheck={false}
                  autoCapitalize="characters"
                  disabled={submitting}
                  required
                />
              </label>
              {formError && <p className="text-sm text-red-300">{formError}</p>}
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Decrypting…' : 'Recover configuration'}
              </Button>
              <p className="text-xs text-slate-500">
                Rate limited to 10 attempts per minute. Wrong keys are not cached.
              </p>
            </form>
          )}

          <div className="rounded-md border border-yellow-800 bg-yellow-950 p-4 text-yellow-100 text-sm">
            <p className="font-semibold">Do not generate a new ENCRYPTION_KEY.</p>
            <p className="mt-1">
              A freshly-generated key cannot decrypt the existing sentinel or encrypted tokens on
              this server. If you don't have your recovery key or a copy of <code>.env</code>, the
              encrypted Plaid tokens and 2FA secrets are permanently unrecoverable — but your
              unencrypted database data is still intact and can be accessed via a new install.
            </p>
          </div>
        </section>
      ) : (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">Manual recovery required</h2>
          <p className="text-sm text-slate-300">
            {status.recoveryFilePresent
              ? 'A recovery file exists but the sentinel is unreadable — use the CLI recovery script or restore from a backup.'
              : 'No recovery file was written for this installation. Restore your original .env from a backup before restarting.'}
          </p>
          <pre className="bg-slate-950 p-3 rounded text-xs text-slate-300 overflow-x-auto">
{`# If you have a .env backup:
cp /path/to/.env.backup /data/config/.env
docker compose restart api

# If you have a recovery key and the web UI is unreachable:
docker compose exec api npx tsx scripts/recover-env.ts`}
          </pre>
        </section>
      )}
    </DiagnosticFrame>
  );
}
