/**
 * Daily Plaid health check — refreshes Item status, detects stale connections, consent expiration, and orphans
 */
export async function processPlaidHealth() {
  console.log('[Plaid Health] Starting daily health check...');
  try {
    const { db } = await import('@kis-books/api/src/db/index.js');
    const { plaidItems, plaidAccounts, plaidAccountMappings, plaidItemActivity } = await import('@kis-books/api/src/db/schema/index.js');
    const { eq, and, sql } = await import('drizzle-orm');
    const { refreshItemStatus } = await import('@kis-books/api/src/services/plaid-connection.service.js');

    const items = await db.select().from(plaidItems)
      .where(and(eq(plaidItems.itemStatus, 'active'), sql`removed_at IS NULL`));

    let checked = 0;
    let errors = 0;
    let orphans = 0;

    for (const item of items) {
      // Refresh status from Plaid
      try {
        await refreshItemStatus(item.id);
        checked++;
      } catch {
        errors++;
      }

      // Orphan detection: check if any mapped company has active admins
      const itemAccounts = await db.select({ id: plaidAccounts.id }).from(plaidAccounts)
        .where(eq(plaidAccounts.plaidItemId, item.id));
      const accountIds = itemAccounts.map((a) => a.id);

      let hasMappings = false;
      for (const acctId of accountIds) {
        const mapping = await db.query.plaidAccountMappings.findFirst({
          where: eq(plaidAccountMappings.plaidAccountId, acctId),
        });
        if (mapping) { hasMappings = true; break; }
      }

      if (!hasMappings && accountIds.length > 0) {
        // No company has any mappings — this item is orphaned
        // Check if it was flagged before to avoid duplicate logs
        const existing = await db.query.plaidItemActivity.findFirst({
          where: and(eq(plaidItemActivity.plaidItemId, item.id), eq(plaidItemActivity.action, 'orphan_detected')),
        });
        if (!existing) {
          await db.insert(plaidItemActivity).values({
            plaidItemId: item.id,
            action: 'orphan_detected',
            details: { message: 'No company has mapped accounts for this connection. It may need to be remapped or removed.' },
          });
          orphans++;
        }
      }
    }

    console.log(`[Plaid Health] Checked ${checked} items, ${errors} errors, ${orphans} orphans detected.`);
  } catch (err: any) {
    console.error('[Plaid Health] Error:', err.message);
  }
}
