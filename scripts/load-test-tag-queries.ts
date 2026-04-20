// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.
//
// Build-plan Phase 9 — load test for the EXISTS-based split-level
// tag filter against a tenant-sized dataset. The goal is not a
// sustained-load benchmark (we don't have k6/wrk wired in); it is
// plan-health verification — EXPLAIN ANALYZE the worst-case queries
// that gained a tag filter in Phase 5 against a synthetic dataset of
// configurable scale and flag any that deviate from the expected
// index-backed plan.
//
// Run against a throwaway database (CREATE DATABASE + seed + drop),
// or the default test DB when DATABASE_URL points there:
//
//   DATABASE_URL=postgres://... tsx scripts/load-test-tag-queries.ts
//
// Environment:
//   TAG_LOAD_TXN_COUNT      default 50_000   — transactions to seed
//   TAG_LOAD_LINES_PER_TXN  default 3        — avg lines per txn
//   TAG_LOAD_TAGS           default 20       — distinct tags
//   TAG_LOAD_P95_MS         default 250      — per-query threshold
//
// Exit code 0 on success, 1 on plan/threshold regression.

import pg from 'pg';

interface Bounds {
  txnCount: number;
  linesPerTxn: number;
  tagCount: number;
  p95Thresholdms: number;
}

function boundsFromEnv(): Bounds {
  return {
    txnCount:       Number(process.env['TAG_LOAD_TXN_COUNT']     || 50_000),
    linesPerTxn:    Number(process.env['TAG_LOAD_LINES_PER_TXN'] || 3),
    tagCount:       Number(process.env['TAG_LOAD_TAGS']          || 20),
    p95Thresholdms: Number(process.env['TAG_LOAD_P95_MS']        || 250),
  };
}

interface QueryCase {
  name: string;
  sql: string;
  params: unknown[];
  mustUseIndex: RegExp | null;
}

function buildCases(tenantId: string, tagId: string, accountId: string): QueryCase[] {
  // Every case mirrors a production query that gained a tag filter in
  // Phase 5 — P&L (line-level aggregation), AR Aging (header EXISTS),
  // Transaction list (header EXISTS with search), GL (line pass-through).
  // The queries are paraphrased to match the shape the reports
  // generate; we don't need perfect parity, only representative plans.
  return [
    {
      name: 'P&L revenue/expense aggregation with tag filter',
      sql: `
        SELECT a.id, SUM(jl.debit) td, SUM(jl.credit) tc
        FROM accounts a
        LEFT JOIN journal_lines jl
          ON jl.account_id = a.id AND jl.tenant_id = $1 AND jl.tag_id = $2
        WHERE a.tenant_id = $1 AND a.account_type IN ('revenue','cogs','expense','other_revenue','other_expense')
        GROUP BY a.id
      `,
      params: [tenantId, tagId],
      mustUseIndex: /idx_journal_lines_(tag_id|tenant_tag|jl_account)/i,
    },
    {
      name: 'AR Aging header EXISTS',
      sql: `
        SELECT t.id, t.balance_due
        FROM transactions t
        WHERE t.tenant_id = $1 AND t.txn_type = 'invoice' AND t.status = 'posted'
          AND EXISTS (
            SELECT 1 FROM journal_lines jl
            WHERE jl.transaction_id = t.id AND jl.tenant_id = $1 AND jl.tag_id = $2
          )
      `,
      params: [tenantId, tagId],
      mustUseIndex: /idx_journal_lines_(tag_id|tenant_tag)/i,
    },
    {
      name: 'Transaction list filtered by tag + date',
      sql: `
        SELECT t.id, t.txn_number, t.txn_date
        FROM transactions t
        WHERE t.tenant_id = $1 AND t.txn_date >= CURRENT_DATE - INTERVAL '365 days'
          AND EXISTS (
            SELECT 1 FROM journal_lines jl
            WHERE jl.transaction_id = t.id AND jl.tenant_id = $1 AND jl.tag_id = $2
          )
        ORDER BY t.txn_date DESC
        LIMIT 100
      `,
      params: [tenantId, tagId],
      mustUseIndex: /idx_journal_lines_(tag_id|tenant_tag)/i,
    },
    {
      name: 'General Ledger account + tag filter',
      sql: `
        SELECT jl.id, jl.debit, jl.credit, jl.description
        FROM journal_lines jl
        JOIN transactions t ON t.id = jl.transaction_id AND t.tenant_id = $1
        WHERE jl.tenant_id = $1 AND jl.account_id = $3 AND jl.tag_id = $2 AND t.status = 'posted'
        ORDER BY t.txn_date
        LIMIT 500
      `,
      params: [tenantId, tagId, accountId],
      mustUseIndex: /idx_journal_lines_(tag_id|tenant_tag|account)/i,
    },
    {
      name: 'Sales by Customer (new Phase 5 report)',
      sql: `
        SELECT c.id, SUM(jl.credit) total
        FROM journal_lines jl
        JOIN transactions t ON t.id = jl.transaction_id AND t.tenant_id = $1
        JOIN accounts a ON a.id = jl.account_id
        LEFT JOIN contacts c ON c.id = t.contact_id AND c.tenant_id = $1
        WHERE jl.tenant_id = $1 AND t.status = 'posted' AND t.txn_type IN ('invoice','cash_sale','credit_memo')
          AND a.account_type IN ('revenue','other_revenue')
          AND jl.credit > 0 AND jl.tag_id = $2
        GROUP BY c.id
      `,
      params: [tenantId, tagId],
      mustUseIndex: /idx_journal_lines_(tag_id|tenant_tag)/i,
    },
  ];
}

async function ensureSeed(pool: pg.Pool, bounds: Bounds) {
  // Pick-or-create a tenant so the script is reusable against a shared
  // test DB. The inserted rows cohabit with other tests under a
  // dedicated slug so a teardown is easy (DELETE FROM tenants WHERE
  // slug = 'tag-load-test-*').
  const slug = `tag-load-test-${Date.now()}`;
  const tenantRow = await pool.query(
    `INSERT INTO tenants (name, slug) VALUES ('Tag Load Test', $1) RETURNING id`,
    [slug],
  );
  const tenantId = tenantRow.rows[0].id as string;

  const acc = await pool.query(
    `INSERT INTO accounts (tenant_id, account_number, name, account_type)
     VALUES ($1, '4000', 'Product Revenue', 'revenue') RETURNING id`,
    [tenantId],
  );
  const revenueAccountId = acc.rows[0].id as string;

  const tags: string[] = [];
  for (let i = 0; i < bounds.tagCount; i++) {
    const t = await pool.query(
      `INSERT INTO tags (tenant_id, name) VALUES ($1, $2) RETURNING id`,
      [tenantId, `load-tag-${i}`],
    );
    tags.push(t.rows[0].id as string);
  }
  const firstTagId = tags[0] as string;

  console.log(`Seeding ${bounds.txnCount} transactions × ~${bounds.linesPerTxn} lines...`);

  // Batched COPY-style INSERT for scale. Postgres' parameter cap is
  // 65535; we insert 1000 rows at a time to stay well under.
  const BATCH = 1000;
  for (let i = 0; i < bounds.txnCount; i += BATCH) {
    const size = Math.min(BATCH, bounds.txnCount - i);
    const txnValues: unknown[] = [];
    const txnPlaceholders: string[] = [];
    for (let j = 0; j < size; j++) {
      const idx = txnValues.length;
      txnPlaceholders.push(`($${idx + 1}, 'invoice', CURRENT_DATE - ($${idx + 2} || ' days')::interval, 'posted', $${idx + 3})`);
      txnValues.push(tenantId, String(Math.floor(Math.random() * 365)), `${(100 + Math.random() * 1000).toFixed(2)}`);
    }
    const inserted = await pool.query(
      `INSERT INTO transactions (tenant_id, txn_type, txn_date, status, total)
       VALUES ${txnPlaceholders.join(',')}
       RETURNING id`,
      txnValues,
    );
    const ids = inserted.rows.map((r) => r.id as string);

    // Lines — each txn gets bounds.linesPerTxn rows, randomly tagged.
    const lineValues: unknown[] = [];
    const linePlaceholders: string[] = [];
    for (const txnId of ids) {
      for (let k = 0; k < bounds.linesPerTxn; k++) {
        const tagId = Math.random() < 0.6 ? tags[Math.floor(Math.random() * tags.length)] : null;
        const idx = lineValues.length;
        linePlaceholders.push(`($${idx + 1}, $${idx + 2}, $${idx + 3}, 0, $${idx + 4}, $${idx + 5})`);
        lineValues.push(tenantId, txnId, revenueAccountId, `${(50 + Math.random() * 500).toFixed(2)}`, tagId);
      }
    }
    await pool.query(
      `INSERT INTO journal_lines (tenant_id, transaction_id, account_id, debit, credit, tag_id)
       VALUES ${linePlaceholders.join(',')}`,
      lineValues,
    );

    if ((i + size) % 10_000 === 0 || i + size === bounds.txnCount) {
      console.log(`  seeded ${i + size}/${bounds.txnCount}`);
    }
  }

  await pool.query('ANALYZE journal_lines; ANALYZE transactions;');
  return { tenantId, tagId: firstTagId, accountId: revenueAccountId, slug };
}

async function runCase(pool: pg.Pool, c: QueryCase): Promise<{ ms: number; plan: string }> {
  const ts = Date.now();
  const plan = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${c.sql}`, c.params);
  const ms = Date.now() - ts;
  return { ms, plan: (plan.rows as Array<{ 'QUERY PLAN': string }>).map((r) => r['QUERY PLAN']).join('\n') };
}

async function main() {
  const bounds = boundsFromEnv();
  const databaseUrl = process.env['DATABASE_URL']
    || 'postgresql://kisbooks:kisbooks@localhost:5434/kisbooks_test';
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });

  console.log(`Load test against ${databaseUrl.replace(/:[^/:@]+@/, ':****@')}`);
  console.log(`Bounds: ${JSON.stringify(bounds)}`);

  const { tenantId, tagId, accountId, slug } = await ensureSeed(pool, bounds);

  let failures = 0;
  for (const c of buildCases(tenantId, tagId, accountId)) {
    const { ms, plan } = await runCase(pool, c);
    const badPlan = c.mustUseIndex && !c.mustUseIndex.test(plan);
    const slow = ms > bounds.p95Thresholdms;
    const status = badPlan ? 'FAIL-PLAN' : slow ? 'FAIL-SLOW' : 'OK';
    console.log(`[${status}] ${ms.toString().padStart(6)} ms  ${c.name}`);
    if (badPlan || slow) {
      failures += 1;
      console.log(plan);
      console.log('---');
    }
  }

  console.log(`Teardown: DELETE FROM tenants WHERE id = '${tenantId}' -- slug=${slug}`);
  // CASCADE removes transactions, journal_lines, accounts, tags along
  // with the tenant. One query, no orphans.
  await pool.query('DELETE FROM tenants WHERE id = $1', [tenantId]);
  await pool.end();

  if (failures > 0) {
    console.error(`Load test: ${failures} failure(s)`);
    process.exit(1);
  }
  console.log('Load test: all queries within plan + threshold');
}

main().catch((err) => { console.error(err); process.exit(1); });
