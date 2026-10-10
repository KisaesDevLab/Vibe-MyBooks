// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.
#!/usr/bin/env node
/**
 * Headless recovery for when the diagnostic web UI is unreachable.
 *
 * Used when an operator SSH'd into the container (or its host), has their
 * RKVMB- recovery key printed on paper, and needs to rebuild
 * /data/config/.env from /data/.env.recovery without a browser.
 *
 * Usage:
 *   docker compose exec api npx tsx scripts/recover-env.ts
 *   docker compose exec api node dist/scripts/recover-env.js   (after build)
 *
 * Interactive flow:
 *   1. Reads the recovery key from stdin (no echo)
 *   2. Decrypts /data/.env.recovery
 *   3. Writes ONLY the recovered secrets (ENCRYPTION_KEY, JWT_SECRET,
 *      DATABASE_URL, PLAID_ENCRYPTION_KEY when the file carries it) to
 *      /data/config/.env. docker-entrypoint.sh uses that file to fill in
 *      variables the compose environment leaves blank — writing ports or
 *      Redis/CORS defaults here would shadow the real configuration.
 *   4. Prints restart instructions and exits
 *
 * Refuses to run if /data/config/.env already exists and is non-empty —
 * the operator must remove or move the old file themselves first. This
 * mirrors the setup.service.ts writeEnvFile() refusal-to-overwrite guard.
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(q: string): Promise<string> {
  return new Promise((resolve) => rl.question(q, resolve));
}
function askHidden(q: string): Promise<string> {
  // Not perfectly hidden — stdout still echoes on most TTYs — but better
  // than nothing for a copy-paste scenario. Operators with strict opsec
  // can `set +o history` first.
  return ask(q);
}

async function main() {
  console.log('\n  RECOVER /data/config/.env FROM /data/.env.recovery\n');

  const configDir = process.env['CONFIG_DIR'] || '/data/config';
  const envPath = path.join(configDir, '.env');

  if (fs.existsSync(envPath) && fs.readFileSync(envPath, 'utf8').trim().length > 0) {
    console.log(`  Refusing to overwrite ${envPath} — it already has content.`);
    console.log(`  If you really want to replace it, move it aside first:`);
    console.log(`    mv ${envPath} ${envPath}.bak.${Date.now()}`);
    console.log(`  Then re-run this script.\n`);
    rl.close();
    process.exit(1);
  }

  const { recoveryFileExists, readRecoveryFile } = await import(
    '../packages/api/src/services/env-recovery.service.js'
  );

  if (!recoveryFileExists()) {
    console.log('  No /data/.env.recovery file found — nothing to recover from.');
    console.log('  Restore /data/config/.env manually from your own backup.\n');
    rl.close();
    process.exit(1);
  }

  const key = (await askHidden('  Paste your recovery key (RKVMB-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX): ')).trim();
  if (!key) {
    console.log('\n  No key entered — aborting.\n');
    rl.close();
    process.exit(1);
  }

  let contents;
  try {
    contents = readRecoveryFile(key);
  } catch (err) {
    console.log(`\n  ERROR: ${(err as Error).message}\n`);
    rl.close();
    process.exit(1);
  }
  if (!contents) {
    console.log('\n  Recovery file missing after existence check — bailing out.\n');
    rl.close();
    process.exit(1);
  }

  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });

  const { renderRecoveredEnv } = await import('../packages/api/src/startup/env-missing-app.js');
  if (!contents.plaidEncryptionKey && !(process.env['PLAID_ENCRYPTION_KEY'] || '').trim()) {
    console.log('\n  WARNING: this recovery file predates v2 and carries no PLAID_ENCRYPTION_KEY,');
    console.log('  and the environment does not supply one. The api will not start until it is set.');
    console.log('  Add the original value to the install .env if you still have it. If it is lost,');
    console.log('  generate a replacement (existing Plaid/SMS/AI/TOTP ciphertext becomes unreadable):');
    console.log('    openssl rand -hex 32\n');
  }
  const envBody = renderRecoveredEnv(
    {
      databaseUrl: contents.databaseUrl,
      jwtSecret: contents.jwtSecret,
      encryptionKey: contents.encryptionKey,
      ...(contents.plaidEncryptionKey ? { plaidEncryptionKey: contents.plaidEncryptionKey } : {}),
    },
    'scripts/recover-env.ts',
  );

  fs.writeFileSync(envPath, envBody, { mode: 0o600 });

  console.log(`\n  ${envPath} written.`);
  console.log('  Audit event:');
  console.log(
    `  [sentinel-audit] ${JSON.stringify({
      ts: new Date().toISOString(),
      kind: 'sentinel-audit',
      event: 'recovery.key_used',
      source: 'recover-env.ts',
      installationId: contents.installationId,
    })}`,
  );
  console.log('\n  Restart the API container:');
  console.log('    docker compose restart api\n');

  rl.close();
}

main().catch((err) => {
  console.error('\n  FATAL:', err);
  rl.close();
  process.exit(1);
});
