/**
 * AI OCR job processor — processes receipt OCR and document classification
 */
export async function processAiOcr(data: { tenantId: string; attachmentId: string; type: 'receipt' | 'statement' | 'classify' }) {
  console.log(`[AI OCR] Processing ${data.type} for attachment ${data.attachmentId}...`);
  try {
    switch (data.type) {
      case 'receipt': {
        const { processReceipt } = await import('@kis-books/api/src/services/ai-receipt-ocr.service.js');
        await processReceipt(data.tenantId, data.attachmentId);
        break;
      }
      case 'statement': {
        const { parseStatement } = await import('@kis-books/api/src/services/ai-statement-parser.service.js');
        await parseStatement(data.tenantId, data.attachmentId);
        break;
      }
      case 'classify': {
        const { classifyAndRoute } = await import('@kis-books/api/src/services/ai-document-classifier.service.js');
        await classifyAndRoute(data.tenantId, data.attachmentId);
        break;
      }
    }
    console.log(`[AI OCR] ${data.type} complete.`);
  } catch (err: any) {
    console.error(`[AI OCR] Error:`, err.message);
  }
}
