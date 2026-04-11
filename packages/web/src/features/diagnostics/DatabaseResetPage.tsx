import { DiagnosticFrame } from './DiagnosticFrame';
import { RegenerateSentinelForm } from './RegenerateSentinelForm';
import type { SentinelHeaderDTO } from './types';

interface Props {
  header: SentinelHeaderDTO | null;
  details: string;
}

/**
 * Shown when the sentinel proves prior setup but the database's
 * `system_settings.installation_id` row is missing. Primary threat: operator
 * ran `docker compose down -v` which destroyed the postgres volume but left
 * the bind-mounted /data alive.
 */
export function DatabaseResetPage({ header, details }: Props) {
  return (
    <DiagnosticFrame title="Database Reset Detected" code="DATABASE_RESET_DETECTED">
      <div className="rounded-md bg-slate-900 border border-slate-700 p-4 space-y-2">
        <p>
          KIS Books was previously set up on this server, but the database no longer has
          a matching installation record. This is a safety block to prevent the setup
          wizard from accidentally re-initializing on top of existing data.
        </p>
        {header && (
          <dl className="text-sm grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 mt-3 font-mono">
            <dt className="text-slate-400">Installation ID:</dt>
            <dd>{header.installationId}</dd>
            <dt className="text-slate-400">Set up on:</dt>
            <dd>{new Date(header.createdAt).toLocaleString()}</dd>
            <dt className="text-slate-400">Set up by:</dt>
            <dd>{header.adminEmail}</dd>
            <dt className="text-slate-400">App version:</dt>
            <dd>{header.appVersion}</dd>
          </dl>
        )}
        <p className="text-xs text-slate-500 mt-2 font-mono">{details}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100">Recovery options</h2>

        <div className="rounded-md bg-slate-900 border border-slate-700 p-4">
          <h3 className="font-semibold text-slate-100">1. Restore from a backup</h3>
          <p className="text-sm text-slate-300 mt-1">
            If you have a <code className="bg-slate-800 px-1 rounded">.vmb</code> backup file, restoring it
            will rebuild the database from the backup and match the surviving sentinel.
          </p>
          <pre className="mt-2 bg-slate-950 p-3 rounded text-xs text-slate-300 overflow-x-auto">
docker compose exec api node dist/scripts/restore.js {'<backup.vmb>'}
          </pre>
        </div>

        <div className="rounded-md bg-slate-900 border border-slate-700 p-4">
          <h3 className="font-semibold text-slate-100">2. Fix the database connection</h3>
          <p className="text-sm text-slate-300 mt-1">
            If your <code className="bg-slate-800 px-1 rounded">DATABASE_URL</code> was changed to point at
            the wrong database, restore the correct value in{' '}
            <code className="bg-slate-800 px-1 rounded">/data/config/.env</code> and restart the container.
          </p>
        </div>

        <div className="rounded-md bg-slate-900 border border-slate-700 p-4">
          <h3 className="font-semibold text-slate-100">3. Intentionally start over</h3>
          <p className="text-sm text-slate-300 mt-1">
            If you really want to re-initialize, delete the sentinel file from inside the container.
            Existing attachments on the volume will <strong>not</strong> be removed.
          </p>
          <pre className="mt-2 bg-slate-950 p-3 rounded text-xs text-slate-300 overflow-x-auto">
docker compose exec api node dist/scripts/reset-sentinel.js
          </pre>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100">Regenerate the sentinel in place</h2>
        <RegenerateSentinelForm
          confirmLabel="Regenerate sentinel"
          description="If you have an admin account and know this database is the correct one, regenerate the sentinel here. This creates a fresh installation_id for the current DB state."
        />
      </section>
    </DiagnosticFrame>
  );
}
