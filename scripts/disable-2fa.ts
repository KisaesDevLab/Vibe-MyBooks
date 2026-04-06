#!/usr/bin/env node
/**
 * Emergency script to disable 2FA for a single user account.
 *
 * Usage:
 *   docker exec -it kisbooks-api node scripts/disable-2fa.js
 *   npx tsx scripts/disable-2fa.ts
 */

import readline from 'readline';
import { eq } from 'drizzle-orm';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(q: string): Promise<string> {
  return new Promise((resolve) => rl.question(q, resolve));
}

async function main() {
  console.log('\n  WARNING: This will disable 2FA for a user account.\n');

  // Dynamic imports so this works standalone
  const { db } = await import('../packages/api/src/db/index.js');
  const { users, tfaTrustedDevices, tfaCodes } = await import('../packages/api/src/db/schema/index.js');
  const { auditLog } = await import('../packages/api/src/middleware/audit.js');

  const email = await ask('  Enter the email address of the account: ');
  const user = await db.query.users.findFirst({ where: eq(users.email, email.trim()) });

  if (!user) {
    console.log(`\n  Error: No account found with email "${email.trim()}".\n`);
    rl.close();
    process.exit(1);
  }

  if (!user.tfaEnabled) {
    console.log(`\n  Account "${email.trim()}" does not have 2FA enabled.\n`);
    rl.close();
    process.exit(0);
  }

  console.log(`\n  Found user: ${user.displayName || user.email} (ID: ${user.id})`);
  console.log(`  Current 2FA methods: ${user.tfaMethods || 'none'}`);
  console.log(`  Recovery codes remaining: ${user.tfaRecoveryCodesRemaining || 0}\n`);

  const confirm = await ask('  Type "DISABLE-2FA" to confirm: ');
  if (confirm.trim() !== 'DISABLE-2FA') {
    console.log('\n  Aborted.\n');
    rl.close();
    process.exit(0);
  }

  // Disable 2FA
  await db.update(users).set({
    tfaEnabled: false,
    tfaMethods: '',
    tfaPreferredMethod: null,
    tfaPhone: null,
    tfaPhoneVerified: false,
    tfaTotpSecretEncrypted: null,
    tfaTotpVerified: false,
    tfaRecoveryCodesEncrypted: null,
    tfaRecoveryCodesRemaining: 0,
    tfaFailedAttempts: 0,
    tfaLockedUntil: null,
    updatedAt: new Date(),
  }).where(eq(users.id, user.id));

  // Revoke all trusted devices
  await db.update(tfaTrustedDevices).set({ isActive: false }).where(eq(tfaTrustedDevices.userId, user.id));

  // Clean up pending codes
  await db.delete(tfaCodes).where(eq(tfaCodes.userId, user.id));

  // Audit log
  await auditLog(user.tenantId, 'create', 'tfa_disabled', user.id, null, { source: 'emergency_cli_override' }, user.id);

  console.log(`\n  2FA has been disabled for ${email.trim()}.`);
  console.log('  The user can now log in with just their password.\n');

  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n  Error:', err.message);
  process.exit(1);
});
