// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.
//
// A payroll import whose posted entries were removed by an admin
// transaction purge must stop blocking a re-post of the same file
// ("This payroll file was already posted … Reverse that import first").

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  tenants, accounts, transactions, journalLines, auditLog as auditLogTable,
  payrollImportSessions, payrollCheckRegisterRows,
} from '../db/schema/index.js';
import * as ledger from './ledger.service.js';
import { deleteTransactionsInDateRange } from './admin.service.js';
import { checkDuplicateFileHash } from './payroll-import.service.js';
import { releaseOrphanedPayrollSessions } from './payroll-orphans.service.js';

let tenantId: string;
let cashId: string;
let expId: string;

async function cleanDb() {
  if (!tenantId) return;
  await db.delete(payrollCheckRegisterRows).where(inArray(
    payrollCheckRegisterRows.sessionId,
    db.select({ id: payrollImportSessions.id }).from(payrollImportSessions).where(eq(payrollImportSessions.tenantId, tenantId)),
  ));
  await db.delete(payrollImportSessions).where(eq(payrollImportSessions.tenantId, tenantId));
  await db.delete(journalLines).where(eq(journalLines.tenantId, tenantId));
  await db.delete(transactions).where(eq(transactions.tenantId, tenantId));
  await db.delete(auditLogTable).where(eq(auditLogTable.tenantId, tenantId));
  await db.delete(accounts).where(eq(accounts.tenantId, tenantId));
  await db.delete(tenants).where(eq(tenants.id, tenantId));
  tenantId = '';
}

beforeEach(async () => {
  await cleanDb();
  const [t] = await db.insert(tenants).values({ name: 'Payroll Orphans', slug: `payroll-orphans-${Date.now()}` }).returning();
  tenantId = t!.id;
  const [cash] = await db.insert(accounts).values({ tenantId, name: 'Cash', accountNumber: '1000', accountType: 'asset' }).returning();
  const [exp] = await db.insert(accounts).values({ tenantId, name: 'Wages', accountNumber: '6000', accountType: 'expense' }).returning();
  cashId = cash!.id;
  expId = exp!.id;
});

afterEach(async () => {
  await cleanDb();
});

async function postCheck(txnDate: string) {
  return ledger.postTransaction(tenantId, {
    txnType: 'journal_entry', txnDate, memo: 'payroll check',
    lines: [
      { accountId: expId, debit: '100', credit: '0' },
      { accountId: cashId, debit: '0', credit: '100' },
    ],
  });
}

/** A posted check-register import whose checks are the given txns. */
async function seedPostedSession(txnIds: string[], fileHash = 'hash-1') {
  const [s] = await db.insert(payrollImportSessions).values({
    tenantId, importMode: 'check_register', originalFilename: 'Checks.csv',
    filePath: '/tmp/x', fileHash, status: 'posted',
  }).returning();
  await db.insert(payrollCheckRegisterRows).values(txnIds.map((transactionId, i) => ({
    sessionId: s!.id, rowNumber: i + 1, checkDate: '2026-02-15', payeeName: `Emp ${i}`,
    amount: '100', posted: true, transactionId,
  })));
  return s!;
}

async function newSession(fileHash = 'hash-1') {
  const [s] = await db.insert(payrollImportSessions).values({
    tenantId, importMode: 'check_register', originalFilename: 'Checks.csv',
    filePath: '/tmp/y', fileHash, status: 'validated',
  }).returning();
  return s!;
}

describe('payroll sessions orphaned by a transaction purge', () => {
  it('blocks a re-post while the prior import is still on the books', async () => {
    const a = await postCheck('2026-02-15');
    await seedPostedSession([a.id]);
    await expect(checkDuplicateFileHash(tenantId, await newSession())).rejects.toThrow(/already posted/);
  });

  it('date-range purge releases the session so the file can be re-posted', async () => {
    const a = await postCheck('2026-02-15');
    const b = await postCheck('2026-02-16');
    const prior = await seedPostedSession([a.id, b.id]);

    await deleteTransactionsInDateRange(tenantId, '2026-02-01', '2026-02-28');

    const [after] = await db.select().from(payrollImportSessions).where(eq(payrollImportSessions.id, prior.id));
    expect(after!.status).toBe('cancelled');
    const rows = await db.select().from(payrollCheckRegisterRows).where(eq(payrollCheckRegisterRows.sessionId, prior.id));
    expect(rows.every((r) => r.posted === false && r.transactionId === null)).toBe(true);

    await expect(checkDuplicateFileHash(tenantId, await newSession())).resolves.toBeUndefined();
  });

  it('keeps a partially purged import posted', async () => {
    const a = await postCheck('2026-02-15');
    const b = await postCheck('2026-05-15');
    const prior = await seedPostedSession([a.id, b.id]);

    await deleteTransactionsInDateRange(tenantId, '2026-02-01', '2026-02-28');

    const [after] = await db.select().from(payrollImportSessions).where(eq(payrollImportSessions.id, prior.id));
    expect(after!.status).toBe('posted');
    await expect(checkDuplicateFileHash(tenantId, await newSession())).rejects.toThrow(/already posted/);
  });

  it('self-heals sessions orphaned before this fix (on the duplicate check)', async () => {
    const a = await postCheck('2026-02-15');
    const prior = await seedPostedSession([a.id]);
    // Simulate the old purge: transactions gone, session left 'posted'.
    await db.delete(journalLines).where(eq(journalLines.transactionId, a.id));
    await db.delete(transactions).where(eq(transactions.id, a.id));

    await expect(checkDuplicateFileHash(tenantId, await newSession())).resolves.toBeUndefined();
    const [after] = await db.select().from(payrollImportSessions).where(eq(payrollImportSessions.id, prior.id));
    expect(after!.status).toBe('cancelled');
  });

  it('handles Mode A / Mode B journal entry references', async () => {
    const a = await postCheck('2026-02-15');
    const b = await postCheck('2026-02-16');
    const [modeA] = await db.insert(payrollImportSessions).values({
      tenantId, importMode: 'employee_level', originalFilename: 'a.csv', filePath: '/tmp/a',
      fileHash: 'ha', status: 'posted', journalEntryId: a.id,
    }).returning();
    const [modeB] = await db.insert(payrollImportSessions).values({
      tenantId, importMode: 'prebuilt_je', originalFilename: 'b.csv', filePath: '/tmp/b',
      fileHash: 'hb', status: 'posted', journalEntryIds: [b.id],
    }).returning();

    expect(await releaseOrphanedPayrollSessions(tenantId)).toBe(0);
    await db.delete(journalLines).where(eq(journalLines.tenantId, tenantId));
    await db.delete(transactions).where(eq(transactions.tenantId, tenantId));
    expect(await releaseOrphanedPayrollSessions(tenantId)).toBe(2);

    const rows = await db.select().from(payrollImportSessions).where(inArray(payrollImportSessions.id, [modeA!.id, modeB!.id]));
    expect(rows.map((r) => r.status)).toEqual(['cancelled', 'cancelled']);
  });
});
