#!/usr/bin/env node
/**
 * Intentionally delete the installation sentinel so the setup wizard can be
 * re-run against this installation. Used when the operator wants to start
 * over after a DATABASE_RESET_DETECTED block.
 *
 * Usage:
 *   docker compose exec api npx tsx scripts/reset-sentinel.ts
 *   docker compose exec api node dist/scripts/reset-sentinel.js  (after build)
 *
 * Safety: requires the operator to type RESET to confirm. Does NOT touch the
 * storage volume beyond removing /data/.sentinel. Files like attachments,
 * backups, and the .initialized marker are left alone so a manual cleanup
 * path is still available if the operator changes their mind. The operator
 * must also delete /data/config/.initialized manually if they want the next
 * boot to run the setup wizard — we leave it intact intentionally so a
 * subsequent reset-sentinel alone is NOT enough to drop a new admin user
 * into an existing database.
 *
 * Audit: emits a sentinel-audit entry to stdout. If this is running inside
 * a diagnostic-mode container, that event is the authoritative log.
 */

import readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(q: string): Promise<string> {
  return new Promise((resolve) => rl.question(q, resolve));
}

async function main() {
  console.log('\n  RESET INSTALLATION SENTINEL\n');
  console.log('  This will delete /data/.sentinel so this installation can be reset.');
  console.log('  The .initialized marker at /data/config/.initialized will NOT be touched —');
  console.log('  you must remove it manually (and usually /data/config/.env too) to actually');
  console.log('  re-run the setup wizard. This belt-and-suspenders design prevents a single');
  console.log('  command from dropping a new admin user on top of an existing database.\n');

  const confirm = await ask('  Type RESET (uppercase) to confirm: ');
  if (confirm.trim() !== 'RESET') {
    console.log('\n  Aborted — no changes made.\n');
    rl.close();
    process.exit(0);
  }

  // Dynamic imports so this script runs in its own process, independent of
  // whether the main API container is in normal or diagnostic mode.
  const { sentinelExists, readSentinelHeader, deleteSentinel } = await import(
    '../packages/api/src/services/sentinel.service.js'
  );
  const { sentinelAudit } = await import('../packages/api/src/startup/sentinel-audit.js');

  if (!sentinelExists()) {
    console.log('\n  No sentinel file found — nothing to reset.\n');
    rl.close();
    process.exit(0);
  }

  // Capture the header before deleting so the audit trail records what was removed.
  let header = null;
  try {
    header = readSentinelHeader();
  } catch {
    // Corrupt file — delete it anyway. That's the whole point of reset.
  }

  deleteSentinel();

  sentinelAudit('sentinel.reset', {
    source: 'reset-sentinel.ts',
    previousInstallationId: header?.installationId,
    previousCreatedAt: header?.createdAt,
    operatorConfirmed: true,
  });

  console.log('\n  Sentinel deleted.');
  console.log('  Next steps to complete a reset:');
  console.log('    1. docker compose exec api rm /data/config/.initialized');
  console.log('    2. docker compose exec api rm /data/config/.env');
  console.log('    3. docker compose restart api');
  console.log('  The setup wizard will run on next start.\n');

  rl.close();
}

main().catch((err) => {
  console.error('\n  ERROR:', err);
  rl.close();
  process.exit(1);
});
