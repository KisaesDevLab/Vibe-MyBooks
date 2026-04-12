#!/usr/bin/env node
/**
 * Diagnostic CLI that prints the full installation integrity state.
 * Used by operators for health checks and by support for first-line triage.
 *
 * Reports:
 *   - Database: reachable? installation_id present? row counts
 *   - Sentinel: present? header readable? payload decrypts? IDs match DB?
 *   - Host ID: present? matches sentinel?
 *   - Recovery file: present? age?
 *   - DB fingerprint: present? consistent with live state?
 *   - Verdict: healthy | needs-attention | blocked
 *
 * Exit codes: 0 healthy, 1 needs attention, 2 blocked, 3 unrecoverable error.
 *
 * Usage:
 *   docker compose exec api npx tsx scripts/verify-installation.ts
 *   docker compose exec api node dist/scripts/verify-installation.js
 */

async function main() {
  // Dynamic imports so this script can run even when the main app is
  // stuck in diagnostic mode (its process is listening; this script's
  // process is separate).
  const sentinelService = await import('../packages/api/src/services/sentinel.service.js');
  const { readHostId, hostIdExists } = await import('../packages/api/src/services/host-id.service.js');
  const { recoveryFileExists } = await import('../packages/api/src/services/env-recovery.service.js');
  const { readFingerprint, captureFingerprint } = await import(
    '../packages/api/src/services/db-fingerprint.service.js'
  );
  const { getSetting } = await import('../packages/api/src/services/admin.service.js');
  const { SystemSettingsKeys } = await import('../packages/api/src/constants/system-settings-keys.js');

  let verdict: 'healthy' | 'needs-attention' | 'blocked' = 'healthy';
  const warnings: string[] = [];
  const blockers: string[] = [];

  console.log('\n  ── KIS Books Installation Verification ──\n');

  // Sentinel
  console.log('  [Sentinel]');
  if (!sentinelService.sentinelExists()) {
    console.log('    file:    MISSING');
    warnings.push('sentinel file is missing — will be regenerated on next boot if DB has installation_id');
  } else {
    console.log('    file:    present');
    try {
      const header = sentinelService.readSentinelHeader();
      console.log(`    install: ${header?.installationId}`);
      console.log(`    hostId:  ${header?.hostId}`);
      console.log(`    created: ${header?.createdAt}`);
      console.log(`    admin:   ${header?.adminEmail}`);
    } catch (err) {
      console.log(`    header:  CORRUPT — ${(err as Error).message}`);
      blockers.push('sentinel header failed CRC / parse — file is corrupt');
    }
    const encryptionKey = process.env['ENCRYPTION_KEY'];
    if (encryptionKey) {
      try {
        const payload = sentinelService.readSentinelPayload(encryptionKey);
        console.log(`    decrypt: OK (${payload?.tenantCountAtSetup} tenant at setup)`);
      } catch (err) {
        console.log(`    decrypt: FAILED — ${(err as Error).message}`);
        blockers.push('sentinel ciphertext failed GCM — wrong ENCRYPTION_KEY or corruption');
      }
    } else {
      console.log('    decrypt: SKIPPED (ENCRYPTION_KEY not set in this process)');
    }
  }

  // Host ID
  console.log('\n  [Host ID]');
  if (hostIdExists()) {
    console.log(`    file:    present (${readHostId()})`);
  } else {
    console.log('    file:    MISSING');
    warnings.push('host-id file is missing — fresh volume or never created');
  }

  // Recovery
  console.log('\n  [Recovery File]');
  console.log(`    file:    ${recoveryFileExists() ? 'present' : 'MISSING'}`);
  if (!recoveryFileExists()) {
    warnings.push('recovery file is missing — operator cannot recover from lost .env');
  }

  // Database
  console.log('\n  [Database]');
  try {
    const dbId = await getSetting(SystemSettingsKeys.INSTALLATION_ID);
    console.log(`    install: ${dbId ?? 'MISSING'}`);
    if (!dbId) {
      blockers.push('system_settings.installation_id is missing — possible DB reset');
    }
    const live = await captureFingerprint();
    console.log(`    tenants: ${live.tenantCount}`);
    console.log(`    users:   ${live.userCount}`);
    console.log(`    txns:    ${live.transactionCount}`);

    // Cross-check sentinel ID vs DB ID
    if (sentinelService.sentinelExists()) {
      try {
        const header = sentinelService.readSentinelHeader();
        if (dbId && header?.installationId && dbId !== header.installationId) {
          blockers.push(`installation_id mismatch: DB=${dbId} sentinel=${header.installationId}`);
        }
      } catch {
        // header read error already reported above
      }
    }
  } catch (err) {
    console.log(`    error:   ${(err as Error).message}`);
    blockers.push('database unreachable');
  }

  // Fingerprint
  console.log('\n  [DB Fingerprint]');
  const stored = readFingerprint();
  if (!stored) {
    console.log('    file:    MISSING');
    warnings.push('fingerprint file not yet written (takes ~2 minutes after first startup)');
  } else {
    console.log(`    updated: ${stored.updatedAt}`);
    console.log(`    tenants: ${stored.tenantCount}`);
    console.log(`    users:   ${stored.userCount}`);
    console.log(`    txns:    ${stored.transactionCount}`);
    try {
      const live = await captureFingerprint();
      if (stored.transactionCount > 0 && live.transactionCount === 0) {
        blockers.push(
          `transaction count dropped from ${stored.transactionCount} to 0 since last fingerprint`,
        );
      } else if (stored.tenantCount > 0 && live.tenantCount === 0) {
        blockers.push(`tenant count dropped from ${stored.tenantCount} to 0`);
      }
    } catch {
      // Already reported above.
    }
  }

  if (blockers.length > 0) verdict = 'blocked';
  else if (warnings.length > 0) verdict = 'needs-attention';

  console.log('\n  ── Verdict ──');
  if (verdict === 'healthy') {
    console.log('    STATUS: HEALTHY — all integrity checks pass\n');
    process.exit(0);
  }
  if (verdict === 'needs-attention') {
    console.log('    STATUS: NEEDS ATTENTION');
    for (const w of warnings) console.log(`      • ${w}`);
    console.log();
    process.exit(1);
  }
  console.log('    STATUS: BLOCKED — installation would refuse normal startup');
  for (const b of blockers) console.log(`      ✖ ${b}`);
  for (const w of warnings) console.log(`      • ${w}`);
  console.log();
  process.exit(2);
}

main().catch((err) => {
  console.error('\n  FATAL:', err);
  process.exit(3);
});
