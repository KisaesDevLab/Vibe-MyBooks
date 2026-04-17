// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState, type ReactNode } from 'react';
import { DatabaseResetPage } from './DatabaseResetPage';
import { EncryptionKeyErrorPage } from './EncryptionKeyErrorPage';
import { InstallationMismatchPage } from './InstallationMismatchPage';
import { EnvMissingPage } from './EnvMissingPage';
import { DiagnosticFrame } from './DiagnosticFrame';
import type { DiagnosticStatusResponse } from './types';

/**
 * Mounted at the root of App.tsx. On app load, fetches
 * /api/diagnostic/status. If the API returns a "blocked" payload (which only
 * happens when bootstrap.ts started the diagnostic app), renders the
 * matching diagnostic page and NEVER falls through to the normal router. If
 * the status endpoint returns 404/503 or isn't reachable, we assume the
 * normal app is running and render children.
 *
 * This keeps the diagnostic surface area tiny: the normal app code never
 * knows about installation integrity checks, and the diagnostic pages are
 * never rendered against a live app.
 */
export function DiagnosticRouter({ children }: { children: ReactNode }) {
  const [state, setState] = useState<
    | { phase: 'checking' }
    | { phase: 'normal' }
    | { phase: 'blocked'; data: DiagnosticStatusResponse }
    | { phase: 'env-missing' }
  >({ phase: 'checking' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Phase B env-missing probe first: if the env-missing app is
        // running, /api/diagnostic/env-status is mounted and returns 200,
        // while /api/diagnostic/status is not mounted and 503s. Order
        // matters because the ENV_MISSING flow has zero DB context.
        const envRes = await fetch('/api/diagnostic/env-status', { cache: 'no-store' });
        if (envRes.ok) {
          const envBody = await envRes.json();
          if (envBody?.state === 'env-missing') {
            if (!cancelled) setState({ phase: 'env-missing' });
            return;
          }
        }

        const res = await fetch('/api/diagnostic/status', {
          cache: 'no-store',
        });
        if (!res.ok) {
          // 404 or 503 means the normal app is running (no diagnostic router
          // mounted). Either way, render the real app.
          if (!cancelled) setState({ phase: 'normal' });
          return;
        }
        const body = (await res.json()) as DiagnosticStatusResponse;
        if (body.result.status === 'blocked') {
          if (!cancelled) setState({ phase: 'blocked', data: body });
        } else {
          if (!cancelled) setState({ phase: 'normal' });
        }
      } catch {
        // Network failure — fall through to the normal app. If this was a
        // real diagnostic state, the normal app's bootstrap will catch it
        // via its own error boundaries.
        if (!cancelled) setState({ phase: 'normal' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.phase === 'checking') {
    // Tiny loading screen. Do NOT render the normal app shell because it
    // may fire off API calls that would 503 in diagnostic mode.
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300 text-sm">
        Checking installation state…
      </div>
    );
  }

  if (state.phase === 'normal') {
    return <>{children}</>;
  }

  if (state.phase === 'env-missing') {
    return <EnvMissingPage />;
  }

  const { result, sentinelHeader, hostId } = state.data;
  if (result.status !== 'blocked') {
    return <>{children}</>;
  }

  switch (result.code) {
    case 'DATABASE_RESET_DETECTED':
      return <DatabaseResetPage header={sentinelHeader} details={result.details} />;

    case 'SENTINEL_DECRYPT_FAILED':
      return <EncryptionKeyErrorPage header={sentinelHeader} details={result.details} />;

    case 'SENTINEL_CORRUPT':
      return <EncryptionKeyErrorPage header={sentinelHeader} details={result.details} corrupt />;

    case 'INSTALLATION_MISMATCH':
      return (
        <InstallationMismatchPage
          status={result}
          sentinelHeader={sentinelHeader}
          currentHostId={hostId}
        />
      );

    case 'ORPHANED_DATA':
      return (
        <DiagnosticFrame title="Orphaned Storage Volume" code="ORPHANED_DATA">
          <div className="rounded-md bg-slate-900 border border-slate-700 p-4">
            <p>
              The storage volume at <code className="bg-slate-800 px-1 rounded">/data</code>{' '}
              contains state from a previous installation (a{' '}
              <code className="bg-slate-800 px-1 rounded">.host-id</code> file), but neither a
              database installation record nor a sentinel. Refusing to re-initialize.
            </p>
            <p className="mt-3 text-sm text-slate-300">
              If you intended to start fresh on this volume, delete{' '}
              <code className="bg-slate-800 px-1 rounded">/data/.host-id</code> and any other files
              you don't need, then restart the container.
            </p>
            <p className="mt-3 text-xs text-slate-500 font-mono">{result.details}</p>
          </div>
        </DiagnosticFrame>
      );

    case 'UNKNOWN':
    default:
      return (
        <DiagnosticFrame title="Installation State Unknown" code={result.code}>
          <div className="rounded-md bg-slate-900 border border-slate-700 p-4">
            <p>The installation validator produced an unexpected state. Contact support.</p>
            <p className="mt-3 text-xs text-slate-500 font-mono">{result.details}</p>
          </div>
        </DiagnosticFrame>
      );
  }
}
