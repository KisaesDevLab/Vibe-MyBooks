// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { DiagnosticFrame } from './DiagnosticFrame';
import type { DiagnosticStatusResponse, SentinelHeaderDTO } from './types';

interface Props {
  status: Extract<DiagnosticStatusResponse['result'], { status: 'blocked' }>;
  sentinelHeader: SentinelHeaderDTO | null;
  currentHostId: string | null;
}

/**
 * Shown when the DB's installation_id is set and valid, the sentinel is
 * readable and decrypts cleanly, BUT the two IDs disagree. This is a
 * hard-stop: the only way it can happen is that DATABASE_URL is pointing at
 * a different installation's database (volume swap / misconfiguration /
 * cross-server restore). No automatic fix — the operator must decide which
 * side is correct.
 */
export function InstallationMismatchPage({ status, sentinelHeader, currentHostId }: Props) {
  const dbIdMatch = status.details.match(/DB installation_id ([0-9a-f-]+)/i);
  const dbId = dbIdMatch?.[1];

  return (
    <DiagnosticFrame title="Installation Mismatch" code="INSTALLATION_MISMATCH">
      <div className="rounded-md bg-slate-900 border border-slate-700 p-4 space-y-2">
        <p>
          The installation sentinel on the storage volume does not match the installation ID in
          the database. The most common cause is that{' '}
          <code className="bg-slate-800 px-1 rounded">DATABASE_URL</code> is pointing at the wrong
          database, or the storage volume was attached to the wrong server.
        </p>
        <p className="text-yellow-200 text-sm mt-2">
          <strong>This is not automatically recoverable.</strong> Starting over without careful
          investigation risks orphaning or duplicating data.
        </p>
      </div>

      <section className="rounded-md bg-slate-900 border border-slate-700 p-4 space-y-3">
        <h2 className="font-semibold text-slate-100">State comparison</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-slate-400 uppercase text-xs">Sentinel (from /data/.sentinel)</p>
            <dl className="font-mono grid grid-cols-[max-content_1fr] gap-x-2 gap-y-1">
              <dt className="text-slate-400">Install ID:</dt>
              <dd>{sentinelHeader?.installationId ?? '—'}</dd>
              <dt className="text-slate-400">Host ID:</dt>
              <dd>{sentinelHeader?.hostId ?? '—'}</dd>
              <dt className="text-slate-400">Created:</dt>
              <dd>{sentinelHeader?.createdAt ?? '—'}</dd>
              <dt className="text-slate-400">Admin:</dt>
              <dd>{sentinelHeader?.adminEmail ?? '—'}</dd>
            </dl>
          </div>
          <div className="space-y-1">
            <p className="text-slate-400 uppercase text-xs">Database (system_settings.installation_id)</p>
            <dl className="font-mono grid grid-cols-[max-content_1fr] gap-x-2 gap-y-1">
              <dt className="text-slate-400">Install ID:</dt>
              <dd>{dbId ?? '—'}</dd>
              <dt className="text-slate-400">Current host ID:</dt>
              <dd>{currentHostId ?? '—'}</dd>
            </dl>
          </div>
        </div>
      </section>

      <section className="rounded-md bg-slate-900 border border-slate-700 p-4 space-y-2">
        <h2 className="font-semibold text-slate-100">Diagnostic steps</h2>
        <ol className="list-decimal list-inside text-sm text-slate-300 space-y-1">
          <li>
            Check <code className="bg-slate-800 px-1 rounded">/data/config/.env</code> — is{' '}
            <code className="bg-slate-800 px-1 rounded">DATABASE_URL</code> pointing at the database
            that matches the sentinel?
          </li>
          <li>
            Check <code className="bg-slate-800 px-1 rounded">docker compose ps</code> — are the
            postgres and api services bound to the volumes you expect?
          </li>
          <li>
            If this host was built by restoring a backup, ensure you ran the backup's{' '}
            <code className="bg-slate-800 px-1 rounded">restore</code> script rather than just
            copying files.
          </li>
        </ol>
      </section>

      <p className="text-xs text-slate-500 font-mono">{status.details}</p>
    </DiagnosticFrame>
  );
}
