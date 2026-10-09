// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { sql } from 'drizzle-orm';
import { db, type DbOrTx } from '../db/index.js';

/**
 * Release payroll import sessions whose posted transactions no longer
 * exist. The admin transaction purges (whole-tenant reset and
 * date-range delete) remove the JEs / checks a session posted but used
 * to leave the session itself in 'posted' — which then tripped the
 * duplicate-file guard forever ("already posted … reverse that import
 * first") with nothing left to reverse.
 *
 * A 'posted' session is orphaned when it references at least one
 * transaction (journal_entry_id, journal_entry_ids[], or a check
 * register row's transaction_id) and NONE of them survive. Partially
 * purged sessions stay posted — some of their entries are still on the
 * books. Orphaned sessions get the same end state as a reversal:
 * status 'cancelled' (shown as "Reversed") and check rows unposted.
 *
 * Kept in its own module (db-only imports) so admin.service can call it
 * without pulling in the payroll import graph.
 */
export async function releaseOrphanedPayrollSessions(tenantId: string, exec: DbOrTx = db): Promise<number> {
  const result = await exec.execute(sql`
    WITH posted AS (
      SELECT id, journal_entry_id, journal_entry_ids
      FROM payroll_import_sessions
      WHERE tenant_id = ${tenantId} AND status = 'posted'
    ),
    refs AS (
      SELECT id AS session_id, journal_entry_id AS txn_id
        FROM posted WHERE journal_entry_id IS NOT NULL
      UNION ALL
      SELECT p.id, e.value::uuid
        FROM posted p,
             jsonb_array_elements_text(
               CASE WHEN jsonb_typeof(p.journal_entry_ids) = 'array' THEN p.journal_entry_ids ELSE '[]'::jsonb END
             ) AS e(value)
      UNION ALL
      SELECT r.session_id, r.transaction_id
        FROM payroll_check_register_rows r
        JOIN posted p ON p.id = r.session_id
        WHERE r.transaction_id IS NOT NULL
    ),
    orphaned AS (
      SELECT refs.session_id
      FROM refs
      LEFT JOIN transactions t ON t.id = refs.txn_id AND t.tenant_id = ${tenantId}
      GROUP BY refs.session_id
      HAVING COUNT(t.id) = 0
    )
    UPDATE payroll_import_sessions s
    SET status = 'cancelled', updated_at = now()
    FROM orphaned o
    WHERE s.id = o.session_id
    RETURNING s.id
  `);
  const released = result.rows.length;

  // Unpost check rows whose transaction is gone, so a later reversal or
  // re-post doesn't trip over a dangling transaction_id.
  await exec.execute(sql`
    UPDATE payroll_check_register_rows r
    SET posted = false, transaction_id = NULL
    WHERE r.transaction_id IS NOT NULL
      AND r.session_id IN (SELECT id FROM payroll_import_sessions WHERE tenant_id = ${tenantId})
      AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.id = r.transaction_id)
  `);

  return released;
}
