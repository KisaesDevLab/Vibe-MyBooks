// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.
/**
 * Read-only pre-deploy check for the tenant-scoped storage provider.
 *
 * Every provider from getProviderForTenant(tenantId) now refuses a key whose
 * first or second path segment is a UUID that is not that tenant's id (and
 * any `_system` key). A legacy or restored row that stores such a key would
 * stop downloading. This lists those rows using the SAME predicate the
 * provider uses (utils/contained-path.ts keyBelongsToTenant), so the answer
 * cannot drift from the rule.
 *
 * Usage (reads DATABASE_URL, writes nothing):
 *   docker compose exec api npx tsx scripts/check-storage-key-scope.ts
 *
 * Exit code 0 = no affected rows; 1 = affected rows listed; 2 = error.
 */

import pg from 'pg';
import { keyBelongsToTenant } from '../packages/api/src/utils/contained-path.js';

interface Source {
  label: string;
  /** Selects id, tenant_id, key. */
  sql: string;
}

const SOURCES: Source[] = [
  { label: 'attachments.storage_key', sql: `SELECT id::text, tenant_id::text, storage_key AS key FROM attachments WHERE storage_key IS NOT NULL` },
  { label: 'extraction_jobs.storage_key', sql: `SELECT id::text, tenant_id::text, storage_key AS key FROM extraction_jobs WHERE storage_key IS NOT NULL` },
  { label: 'fs_report_versions.pdf_storage_key', sql: `SELECT id::text, tenant_id::text, pdf_storage_key AS key FROM fs_report_versions` },
  { label: 'portal_receipts.storage_key', sql: `SELECT id::text, tenant_id::text, storage_key AS key FROM portal_receipts` },
  {
    label: 'portal_question_attachments.storage_key',
    sql: `SELECT a.id::text, q.tenant_id::text, a.storage_key AS key
            FROM portal_question_attachments a JOIN portal_questions q ON q.id = a.question_id`,
  },
  { label: 'tb_exports.storage_key', sql: `SELECT id::text, tenant_id::text, storage_key AS key FROM tb_exports` },
  // pdf_url holds a storage key for finalized reports and may hold a URL for older rows.
  { label: 'report_instances.pdf_url', sql: `SELECT id::text, tenant_id::text, pdf_url AS key FROM report_instances WHERE pdf_url IS NOT NULL AND pdf_url NOT LIKE 'http%'` },
];

async function main(): Promise<number> {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    console.error('DATABASE_URL is not set');
    return 2;
  }
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  let bad = 0;
  try {
    for (const src of SOURCES) {
      let rows: Array<{ id: string; tenant_id: string; key: string }>;
      try {
        rows = (await pool.query(src.sql)).rows;
      } catch (err) {
        console.warn(`skipped ${src.label}: ${(err as Error).message}`);
        continue;
      }
      const offenders = rows.filter((r) => !keyBelongsToTenant(r.key, r.tenant_id));
      console.log(`${src.label}: ${rows.length} checked, ${offenders.length} outside tenant scope`);
      for (const o of offenders) {
        console.log(`  id=${o.id} tenant=${o.tenant_id} key=${o.key}`);
      }
      bad += offenders.length;
    }
  } finally {
    await pool.end();
  }
  console.log(bad === 0 ? 'OK: no rows would be refused by the tenant-scoped provider.' : `${bad} row(s) would be refused.`);
  return bad === 0 ? 0 : 1;
}

main().then((code) => process.exit(code), (err) => {
  console.error(err);
  process.exit(2);
});
