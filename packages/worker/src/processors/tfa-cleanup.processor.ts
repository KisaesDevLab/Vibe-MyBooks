/**
 * Daily cleanup job for TFA ephemeral data:
 * - Deletes expired and used verification codes from tfa_codes
 * - Deletes expired trusted devices from tfa_trusted_devices
 */
export async function processTfaCleanup() {
  console.log('[TFA Cleanup] Starting cleanup of expired TFA data...');

  try {
    const { db } = await import('@kis-books/api/src/db/index.js');
    const { tfaCodes, tfaTrustedDevices } = await import('@kis-books/api/src/db/schema/index.js');
    const { lt, eq, or } = await import('drizzle-orm');

    const now = new Date();

    // Delete expired or used codes
    const deletedCodes = await db.delete(tfaCodes).where(
      or(
        lt(tfaCodes.expiresAt, now),
        eq(tfaCodes.used, true),
      ),
    ).returning({ id: tfaCodes.id });

    // Deactivate expired trusted devices
    const expiredDevices = await db.update(tfaTrustedDevices).set({ isActive: false }).where(
      lt(tfaTrustedDevices.expiresAt, now),
    ).returning({ id: tfaTrustedDevices.id });

    console.log(`[TFA Cleanup] Removed ${deletedCodes.length} expired/used codes, deactivated ${expiredDevices.length} expired devices.`);
  } catch (err: any) {
    console.error('[TFA Cleanup] Error:', err.message);
  }
}
