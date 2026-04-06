/**
 * Storage migration processor — migrates files from one storage provider to another
 */
export async function processStorageMigration(data: { migrationId: string }) {
  console.log(`[Storage Migration] Processing migration ${data.migrationId}...`);
  try {
    const { processMigration } = await import('@kis-books/api/src/services/storage-migration.service.js');
    await processMigration(data.migrationId);
    console.log(`[Storage Migration] Migration ${data.migrationId} complete.`);
  } catch (err: any) {
    console.error(`[Storage Migration] Error:`, err.message);
  }
}
