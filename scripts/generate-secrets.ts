// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Prints the four secrets required for a manual install (users who
// aren't running scripts/install.sh / install.ps1). The variable
// names match docker-compose.yml's `${VAR:?...}` guards verbatim, so
// copy-pasting the output into .env satisfies compose's preflight
// without any further edits.

import crypto from 'crypto';

const postgresPassword = crypto.randomBytes(16).toString('hex');  // 32 hex chars
const jwtSecret        = crypto.randomBytes(24).toString('hex');  // 48 hex chars (env.ts min is 20)
const encryptionKey    = crypto.randomBytes(32).toString('hex');  // 64 hex chars (env.ts min is 32)
const plaidEncKey      = crypto.randomBytes(32).toString('hex');  // 64 hex chars

console.log('===========================================');
console.log('  Vibe MyBooks — Generated Secrets');
console.log('===========================================');
console.log('');
console.log('Paste these four lines into your .env file.');
console.log('Compose refuses to start with any of them blank.');
console.log('');
console.log('POSTGRES_PASSWORD=' + postgresPassword);
console.log('JWT_SECRET=' + jwtSecret);
console.log('ENCRYPTION_KEY=' + encryptionKey);
console.log('PLAID_ENCRYPTION_KEY=' + plaidEncKey);
console.log('');
console.log('⚠️  Save these now — they will not be shown again.');
console.log('⚠️  Do NOT rotate ENCRYPTION_KEY or PLAID_ENCRYPTION_KEY');
console.log('    after first boot: they wrap data at rest and a new');
console.log('    value can no longer decrypt the existing rows.');
console.log('===========================================');
