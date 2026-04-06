/**
 * Daily balance refresh — updates Plaid account balances and syncs to mapped COA accounts
 */
export async function processPlaidBalance() {
  console.log('[Plaid Balance] Starting daily balance refresh...');
  try {
    const { db } = await import('@kis-books/api/src/db/index.js');
    const { plaidItems, plaidAccounts, plaidAccountMappings, accounts } = await import('@kis-books/api/src/db/schema/index.js');
    const { eq, and, sql } = await import('drizzle-orm');
    const { decrypt } = await import('@kis-books/api/src/utils/encryption.js');
    const { getBalances } = await import('@kis-books/api/src/services/plaid-client.service.js');

    const items = await db.select().from(plaidItems)
      .where(and(eq(plaidItems.itemStatus, 'active'), sql`removed_at IS NULL`));

    let updated = 0;
    for (const item of items) {
      try {
        const accessToken = decrypt(item.accessTokenEncrypted);
        const balances = await getBalances(accessToken);

        for (const b of balances) {
          // Update plaid account balance (system-scoped)
          await db.update(plaidAccounts).set({
            currentBalance: b.balances.current?.toString() || null,
            availableBalance: b.balances.available?.toString() || null,
            balanceUpdatedAt: new Date(),
          }).where(eq(plaidAccounts.plaidAccountId, b.account_id));

          // Find mapping and update COA account balance
          const acct = await db.query.plaidAccounts.findFirst({
            where: eq(plaidAccounts.plaidAccountId, b.account_id),
          });
          if (acct) {
            const mapping = await db.query.plaidAccountMappings.findFirst({
              where: eq(plaidAccountMappings.plaidAccountId, acct.id),
            });
            if (mapping && b.balances.current != null) {
              await db.update(accounts).set({ balance: b.balances.current.toString() })
                .where(eq(accounts.id, mapping.mappedAccountId));
            }
          }
          updated++;
        }
      } catch { /* skip failing items */ }
    }
    console.log(`[Plaid Balance] Updated ${updated} account balances.`);
  } catch (err: any) {
    console.error('[Plaid Balance] Error:', err.message);
  }
}
