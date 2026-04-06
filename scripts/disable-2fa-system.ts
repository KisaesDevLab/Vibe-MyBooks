#!/usr/bin/env node
/**
 * Emergency script to disable 2FA system-wide.
 * Individual user 2FA settings are preserved (so re-enabling restores them).
 *
 * Usage:
 *   docker exec -it kisbooks-api node scripts/disable-2fa-system.js
 *   npx tsx scripts/disable-2fa-system.ts
 */

import readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(q: string): Promise<string> {
  return new Promise((resolve) => rl.question(q, resolve));
}

async function main() {
  console.log('\n  WARNING: This will disable 2FA for the entire system.');
  console.log('  Individual user 2FA settings will be preserved.\n');

  const { db } = await import('../packages/api/src/db/index.js');
  const { tfaConfig } = await import('../packages/api/src/db/schema/index.js');

  // Check current state
  const config = await db.query.tfaConfig.findFirst();
  if (!config) {
    console.log('  2FA has never been configured on this system.\n');
    rl.close();
    process.exit(0);
  }

  if (!config.isEnabled) {
    console.log('  2FA is already disabled system-wide.\n');
    rl.close();
    process.exit(0);
  }

  const confirm = await ask('  Type "DISABLE-ALL-2FA" to confirm: ');
  if (confirm.trim() !== 'DISABLE-ALL-2FA') {
    console.log('\n  Aborted.\n');
    rl.close();
    process.exit(0);
  }

  const { eq } = await import('drizzle-orm');
  await db.update(tfaConfig).set({
    isEnabled: false,
    updatedAt: new Date(),
  }).where(eq(tfaConfig.id, config.id));

  console.log('\n  2FA has been disabled system-wide.');
  console.log('  No users will be prompted for 2FA until it is re-enabled.');
  console.log('  Individual user settings have been preserved.\n');

  rl.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n  Error:', err.message);
  process.exit(1);
});
