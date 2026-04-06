/**
 * AI categorization job processor — processes individual or batch categorization requests
 */
export async function processAiCategorization(data: { tenantId: string; feedItemId?: string; feedItemIds?: string[] }) {
  console.log('[AI Categorization] Processing...');
  try {
    const { categorize, batchCategorize } = await import('@kis-books/api/src/services/ai-categorization.service.js');

    if (data.feedItemIds) {
      await batchCategorize(data.tenantId, data.feedItemIds);
    } else if (data.feedItemId) {
      await categorize(data.tenantId, data.feedItemId);
    }
    console.log('[AI Categorization] Complete.');
  } catch (err: any) {
    console.error('[AI Categorization] Error:', err.message);
  }
}
