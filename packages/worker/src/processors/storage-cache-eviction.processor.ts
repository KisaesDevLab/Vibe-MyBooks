/**
 * Daily storage cache eviction — removes expired local cache files for cloud-stored attachments
 */
export async function processStorageCacheEviction() {
  console.log('[Storage Cache] Starting cache eviction...');
  try {
    const { evictExpired } = await import('@kis-books/api/src/services/storage/cache.service.js');
    const evicted = await evictExpired();
    console.log(`[Storage Cache] Evicted ${evicted} expired cache files.`);
  } catch (err: any) {
    console.error('[Storage Cache] Error:', err.message);
  }
}
