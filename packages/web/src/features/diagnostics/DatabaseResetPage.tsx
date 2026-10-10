// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState, type FormEvent } from 'react';
import { DiagnosticFrame } from './DiagnosticFrame';
import { RegenerateSentinelForm } from './RegenerateSentinelForm';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import type { SentinelHeaderDTO } from './types';

interface Props {
  header: SentinelHeaderDTO | null;
  details: string;
  /** /data/.env.recovery exists — the recovery key can prove ownership. */
  recoveryFilePresent?: boolean;
  /** The operator already ran "prepare restore"; a restart is all that is left. */
  restoreIntent?: boolean;
}

/**
 * Shown when the sentinel proves prior setup but the database's
 * `system_settings.installation_id` row is missing. Primary threat: operator
 * ran `docker compose down -v` which destroyed the postgres volume but left
 * the bind-mounted /data alive.
 *
 * The database is EMPTY in this state, so no account can authenticate. The
 * primary recovery path therefore proves ownership with the installation's
 * recovery key instead: POST /api/diagnostic/prepare-restore clears the
 * sentinel + `.initialized` marker (copies kept), keeps `.host-id`, records
 * the intent, and the next boot opens the setup wizard with "Restore from
 * backup". Everything here works from the browser — no CLI is required.
 */
export function DatabaseResetPage({ header, details, recoveryFilePresent = false, restoreIntent = false }: Props) {
  return (
    <DiagnosticFrame title="Database Reset Detected" code="DATABASE_RESET_DETECTED">
      <div className="rounded-md bg-slate-900 border border-slate-700 p-4 space-y-2">
        <p>
          Vibe MyBooks was previously set up on this server, but the database no longer has
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

        <div className="rounded-md bg-slate-900 border border-slate-700 p-4 space-y-3">
          <h3 className="font-semibold text-slate-100">1. Restore from a backup (recommended)</h3>
          <p className="text-sm text-slate-300">
            The database is empty, so there is no account to sign in with. Prove you own this
            installation with the <strong>recovery key</strong> you saved during setup. The server
            will then set the old sentinel aside and, after a restart, open the setup wizard
            where you choose <strong>Restore from backup</strong> (upload a <code className="bg-slate-800 px-1 rounded">.vmx</code>/
            <code className="bg-slate-800 px-1 rounded">.vmb</code> file, pick one from the local backup folder or
            mounted drive, or pull it from Backblaze B2). Attachments, the host identity and your
            recovery key are kept, so the restore is recognised as same-server.
          </p>
          <PrepareRestoreForm recoveryFilePresent={recoveryFilePresent} alreadyPrepared={restoreIntent} />
        </div>

        <div className="rounded-md bg-slate-900 border border-slate-700 p-4">
          <h3 className="font-semibold text-slate-100">2. Fix the database connection</h3>
          <p className="text-sm text-slate-300 mt-1">
            If <code className="bg-slate-800 px-1 rounded">DATABASE_URL</code> (or{' '}
            <code className="bg-slate-800 px-1 rounded">POSTGRES_PASSWORD</code> in the install{' '}
            <code className="bg-slate-800 px-1 rounded">.env</code>) was changed to point at the wrong
            or an empty database, restore the correct value and restart the api container. Nothing
            on this page needs to run in that case.
          </p>
        </div>

        <div className="rounded-md bg-slate-900 border border-slate-700 p-4">
          <h3 className="font-semibold text-slate-100">3. Start over without a backup</h3>
          <p className="text-sm text-slate-300 mt-1">
            Use option 1 to unlock the wizard, then choose <strong>New installation</strong> instead of
            Restore. Existing attachments on the volume are <strong>not</strong> removed. To wipe the
            volume entirely use <code className="bg-slate-800 px-1 rounded">scripts/factory-reset.sh</code> on the host.
          </p>
        </div>

        <div className="rounded-md bg-slate-900 border border-slate-700 p-4">
          <h3 className="font-semibold text-slate-100">Without a recovery key (shell access)</h3>
          <p className="text-sm text-slate-300 mt-1">
            If this installation has no recovery file, or you no longer have the key, file-system
            access is the proof of ownership. Set the sentinel and the setup marker aside, keep{' '}
            <code className="bg-slate-800 px-1 rounded">.host-id</code>, record the restore intent, then restart:
          </p>
          <pre className="mt-2 bg-slate-950 p-3 rounded text-xs text-slate-300 overflow-x-auto">
{`docker compose exec api sh -c '\\
  mv /data/.sentinel /data/.sentinel.pre-restore-$(date +%s) && \\
  mv /data/config/.initialized /data/config/.initialized.pre-restore-$(date +%s) 2>/dev/null; \\
  echo "{\\"requestedAt\\":\\"$(date -u +%FT%TZ)\\",\\"source\\":\\"manual\\"}" > /data/.restore-intent'
docker compose restart api`}
          </pre>
          <p className="text-xs text-slate-500 mt-2">
            CLI alternative: <code className="bg-slate-800 px-1 rounded">docker compose exec api npx tsx scripts/reset-sentinel.ts</code>{' '}
            (interactive; prints the same follow-up steps).
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold text-slate-100">Regenerate the sentinel in place</h2>
        <RegenerateSentinelForm
          confirmLabel="Regenerate sentinel"
          description="Only if this database actually still holds your accounts (for example DATABASE_URL was repointed at a database restored by other means): sign in with a super-admin account and the sentinel is rebuilt for the current database. On a truly empty database this form cannot succeed — use option 1."
        />
      </section>
    </DiagnosticFrame>
  );
}

function PrepareRestoreForm({ recoveryFilePresent, alreadyPrepared }: { recoveryFilePresent: boolean; alreadyPrepared: boolean }) {
  const [key, setKey] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (alreadyPrepared || success) {
    return (
      <div className="rounded-md border border-green-700 bg-green-950 p-4 space-y-2">
        <p className="text-green-200 font-semibold">
          {success ?? 'This server is already prepared for a restore.'}
        </p>
        <p className="text-sm text-green-300">Restart the api container, then open the app — the setup wizard will offer Restore from backup.</p>
        <pre className="bg-slate-950 p-3 rounded text-xs text-slate-300 overflow-x-auto">docker compose restart api</pre>
      </div>
    );
  }

  if (!recoveryFilePresent) {
    return (
      <div className="rounded-md border border-yellow-800 bg-yellow-950 p-4 text-yellow-100 text-sm">
        <p className="font-semibold">No recovery file on this server.</p>
        <p className="mt-1">
          <code className="bg-yellow-900/60 px-1 rounded">/data/.env.recovery</code> is missing, so a recovery key cannot be
          verified here. Use the shell commands under <em>Without a recovery key</em> below.
        </p>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/diagnostic/prepare-restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryKey: key.trim(), confirm: confirm.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.message ?? `request failed (${res.status})`);
      setSuccess(body.message ?? 'Prepared for restore.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-md border border-slate-700 bg-slate-950 p-4 space-y-3">
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
      <label className="block">
        <span className="block text-xs uppercase text-slate-400 mb-1">Type RESTORE to confirm</span>
        <Input
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="RESTORE"
          className="font-mono"
          autoComplete="off"
          spellCheck={false}
          disabled={submitting}
          required
        />
      </label>
      {error && <p className="text-sm text-red-300">{error}</p>}
      <Button type="submit" disabled={submitting || confirm.trim() !== 'RESTORE' || !key.trim()}>
        {submitting ? 'Verifying…' : 'Unlock the setup wizard for restore'}
      </Button>
      <p className="text-xs text-slate-500">
        Rate limited to 10 attempts per minute. Nothing is deleted: the current sentinel and marker are
        kept as timestamped copies under <code className="bg-slate-800 px-1 rounded">/data</code>.
      </p>
    </form>
  );
}
