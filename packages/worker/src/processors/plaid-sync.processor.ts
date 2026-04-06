/**
 * Periodic Plaid transaction sync (every 4 hours fallback — primary sync is webhook-triggered)
 */
export async function processPlaidSync() {
  console.log('[Plaid Sync] Starting periodic sync for all tenants...');
  try {
    const { syncAllTenants } = await import('@kis-books/api/src/services/plaid-sync.service.js');
    await syncAllTenants();
    console.log('[Plaid Sync] Periodic sync complete.');
  } catch (err: any) {
    console.error('[Plaid Sync] Error:', err.message);
  }
}
