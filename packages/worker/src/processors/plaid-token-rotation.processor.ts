/**
 * Periodic Plaid access token rotation (every 90 days).
 * Rotates tokens transparently — no user action required.
 */
export async function processPlaidTokenRotation() {
  console.log('[Plaid Token Rotation] Starting rotation check...');
  try {
    const { db } = await import('@kis-books/api/src/db/index.js');
    const { plaidItems } = await import('@kis-books/api/src/db/schema/index.js');
    const { eq, and, sql, lt } = await import('drizzle-orm');
    const { rotateItemToken } = await import('@kis-books/api/src/services/plaid-connection.service.js');

    // Find items created or last rotated more than 90 days ago
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);

    const items = await db.select().from(plaidItems)
      .where(and(
        eq(plaidItems.itemStatus, 'active'),
        sql`removed_at IS NULL`,
        lt(plaidItems.createdAt, cutoff),
      ));

    let rotated = 0;
    let errors = 0;
    for (const item of items) {
      try {
        await rotateItemToken(item.id);
        rotated++;
      } catch (err: any) {
        console.error(`[Plaid Token Rotation] Failed for item ${item.id}: ${err.message}`);
        errors++;
      }
    }

    console.log(`[Plaid Token Rotation] Rotated ${rotated} tokens, ${errors} errors.`);
  } catch (err: any) {
    console.error('[Plaid Token Rotation] Error:', err.message);
  }
}
