// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

// Pure helpers for the first-run setup wizard — extracted out of
// FirstRunSetupWizard.tsx so they can be unit-tested without spinning
// up jsdom + the full component tree. Each function here has zero React
// dependencies.
//
// What lives here:
//   * scorePassword           — strength meter logic
//   * saveSetupProgress /
//     loadSetupProgress /
//     clearSetupProgress      — localStorage persistence (whitelisted
//                               fields only; secrets never written)
//   * friendlyErrorMessage    — plain-English translation of raw driver
//                               / SMTP / finalize errors
//   * coaPreviewForBusinessType — sample of accounts that will be seeded

import { BUSINESS_TEMPLATES } from '@kis-books/shared';

// Bumped when the persisted shape changes so old incompatible saves are
// ignored rather than crashing on merge.
const PROGRESS_STORAGE_KEY = 'kisbooks-setup-progress-v1';

// ─── Password strength ────────────────────────────────────────────

export interface PasswordScore {
  /** 0 = empty, 1 = weak, 2 = fair, 3 = good, 4 = strong. */
  level: 0 | 1 | 2 | 3 | 4;
  label: '' | 'Too short' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  /** Color key matching Tailwind hue names for the meter bar. */
  color: 'gray' | 'red' | 'orange' | 'yellow' | 'green';
  /** Next-step hints for the user (empty once strong). */
  hints: string[];
}

/**
 * Score a password on length + character-class diversity. Deliberately
 * simple so there's no dependency on zxcvbn's 800KB dictionary — most
 * of its value is blocking common passwords, and the 12-character
 * minimum + mixed-character pressure already closes that gap for the
 * casual-attacker threat model.
 */
export function scorePassword(pw: string): PasswordScore {
  if (!pw) return { level: 0, label: '', color: 'gray', hints: [] };
  if (pw.length < 12) {
    return {
      level: 1,
      label: 'Too short',
      color: 'red',
      hints: [`Use at least 12 characters (you have ${pw.length}).`],
    };
  }

  const classes = {
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    digit: /\d/.test(pw),
    symbol: /[^a-zA-Z0-9]/.test(pw),
  };
  const classCount = Object.values(classes).filter(Boolean).length;

  const hints: string[] = [];
  if (!classes.upper) hints.push('Add an UPPERCASE letter.');
  if (!classes.lower) hints.push('Add a lowercase letter.');
  if (!classes.digit) hints.push('Add a number.');
  if (!classes.symbol) hints.push('Add a symbol (!@#$...).');
  if (pw.length < 16 && classCount < 4) hints.push('Make it at least 16 characters.');

  if (classCount <= 1) return { level: 1, label: 'Weak', color: 'red', hints };
  if (classCount === 2) return { level: 2, label: 'Fair', color: 'orange', hints };
  if (classCount === 3 || pw.length < 16) {
    return { level: 3, label: 'Good', color: 'yellow', hints };
  }
  return { level: 4, label: 'Strong', color: 'green', hints: [] };
}

// ─── localStorage persistence ─────────────────────────────────────
// Only these fields survive a page reload. Passwords and security
// keys are deliberately excluded: leaving bcrypt-destined strings in
// localStorage would be a real credential-leak risk (any extension
// with page-level access to localStorage could read them), and secret
// keys regenerate fresh on reload anyway via /api/setup/generate-secrets.

export interface PersistedSetupProgress {
  step: number;
  adminEmail?: string;
  adminDisplayName?: string;
  businessName?: string;
  entityType?: string;
  businessType?: string;
  smtpPreset?: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpFrom?: string;
  skipEmail?: boolean;
  createDemoCompany?: boolean;
  apiPort?: string;
  frontendPort?: string;
  redisHost?: string;
  redisPort?: string;
  dbHost?: string;
  dbPort?: string;
  dbName?: string;
  dbUser?: string;
  // Deliberately omitted: adminPassword, adminPasswordConfirm, smtpPass,
  // dbPassword, jwtSecret, backupKey, encryptionKey, plaidEncryptionKey.
}

export function saveSetupProgress(progress: PersistedSetupProgress): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Quota exhausted or localStorage disabled (private browsing on some
    // browsers). Silent — persistence is best-effort; the wizard still
    // works, just without resume.
  }
}

export function loadSetupProgress(): PersistedSetupProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as PersistedSetupProgress;
  } catch {
    return null;
  }
}

export function clearSetupProgress(): void {
  try {
    localStorage.removeItem(PROGRESS_STORAGE_KEY);
  } catch {
    // Same best-effort semantics as saveSetupProgress.
  }
}

// ─── Friendly error translations ──────────────────────────────────
// The setup wizard surfaces errors from three very different layers:
//   1. Postgres driver (ECONNREFUSED, password auth, unknown DB, …)
//   2. Nodemailer / SMTP servers (EAUTH, EENVELOPE, TLS, greeting timeout)
//   3. /api/setup/initialize (port-in-use, disk full, .env write failure,
//      demo-seed errors bubbled up as [step:demo] prefixes)
//
// Each maps to a short plain-English sentence + optional details. Keeps
// the raw message in a parenthetical so the operator can still find the
// underlying cause when needed.

export function friendlyErrorMessage(raw: string): string {
  if (!raw) return 'Connection failed.';
  const m = raw.toLowerCase();

  // ── Database errors ──
  if (m.includes('econnrefused') || m.includes('connection refused')) {
    return 'Can\u2019t reach the database yet. If Postgres is still starting up, wait a moment and try again.';
  }
  if (m.includes('password authentication failed')) {
    return 'The database password is wrong. Check the POSTGRES_PASSWORD value in your .env file.';
  }
  if (m.includes('etimedout') || m.includes('timeout')) {
    return 'The database didn\u2019t respond in time. Check that it\u2019s running and reachable on the network.';
  }
  if (m.includes('enotfound') || m.includes('getaddrinfo')) {
    return 'Couldn\u2019t find the database host. Double-check the Host field in Advanced settings.';
  }
  if (m.includes('does not exist') && m.includes('database')) {
    return 'The database doesn\u2019t exist yet. Check the Database name in Advanced settings.';
  }

  // ── SMTP errors ──
  if (m.includes('eauth') || m.includes('invalid login') || m.includes('535')) {
    return 'The email username or password is wrong. For Gmail, use an App Password, not your account password.';
  }
  if (m.includes('eenvelope')) {
    return 'The email provider rejected the From address. It must be an address that\u2019s authorized to send from this SMTP account.';
  }
  if (m.includes('certificate') || m.includes('self signed') || m.includes('self-signed') || m.includes('unable to verify')) {
    return 'The email server\u2019s TLS certificate couldn\u2019t be verified. If you\u2019re using a private mail server, check its certificate setup.';
  }
  if (m.includes('connection closed') || m.includes('greeting never received')) {
    return 'The email server hung up unexpectedly. Verify the SMTP host and port (587 for STARTTLS, 465 for SSL).';
  }
  if (m.includes('dns lookup failed') || (m.includes('smtp') && m.includes('enotfound'))) {
    return 'Couldn\u2019t find the SMTP host. Double-check the hostname for typos.';
  }

  // ── Setup / initialize errors ──
  if (m.includes('port') && m.includes('in use')) {
    return 'A port we need is already in use. Change the Advanced → Ports settings, or stop the conflicting service.';
  }
  if (m.includes('enospc') || m.includes('no space left')) {
    return 'The disk is full. Free up space on the host and try again.';
  }
  if (m.includes('eacces') || m.includes('permission denied')) {
    return 'Permission denied while writing setup files. Check that the /data volume is writable by the container user.';
  }
  if (m.includes('already completed') || m.includes('already exist')) {
    return 'Setup appears to have completed already. Try navigating to the login page.';
  }
  if (m.includes('refusing to overwrite')) {
    return 'Setup found an existing .env on disk and refused to overwrite it. Restart with a clean /data directory to redo setup.';
  }

  return `Something went wrong. (${raw})`;
}

// ─── Business-type COA preview ────────────────────────────────────

export interface CoaPreview {
  total: number;
  /** Sample of user-facing account names from this template. */
  sample: string[];
  /** Count per top-level category. */
  byCategory: Record<string, number>;
}

/**
 * Return a human-friendly preview of the chart of accounts that will be
 * seeded for the given business-type slug. Uses the same BUSINESS_TEMPLATES
 * constant the backend reads, so the wizard always matches what the
 * server will actually create. Accounts marked `isSystem` are excluded
 * from the sample — those are internal (retained earnings, opening
 * balances, etc.) and not something the user should focus on.
 */
export function coaPreviewForBusinessType(slug: string): CoaPreview | null {
  const template = BUSINESS_TEMPLATES[slug];
  if (!template) return null;

  const userFacing = template.filter((a) => !a.isSystem);

  const categoryLabel: Record<string, string> = {
    asset: 'Assets',
    liability: 'Liabilities',
    equity: 'Equity',
    revenue: 'Revenue',
    other_revenue: 'Other revenue',
    cogs: 'Cost of goods sold',
    expense: 'Expenses',
    other_expense: 'Other expenses',
  };

  const byCategory: Record<string, number> = {};
  for (const a of userFacing) {
    const key = categoryLabel[a.accountType] ?? a.accountType;
    byCategory[key] = (byCategory[key] ?? 0) + 1;
  }

  // Prefer accounts that show the template's "personality" — revenue,
  // cogs, and expense lines distinguish a Restaurant from a Consultancy
  // far better than generic Cash / AR / Equity do.
  const interesting = userFacing.filter(
    (a) => a.accountType === 'revenue' || a.accountType === 'cogs' || a.accountType === 'expense',
  );
  const fallback = userFacing.filter(
    (a) => a.accountType !== 'revenue' && a.accountType !== 'cogs' && a.accountType !== 'expense',
  );
  const sample = [...interesting, ...fallback].slice(0, 8).map((a) => a.name);

  return {
    total: template.length,
    sample,
    byCategory,
  };
}
