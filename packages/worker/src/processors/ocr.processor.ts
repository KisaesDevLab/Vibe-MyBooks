// BullMQ OCR job processor stub
// Will be wired up when BullMQ queue is configured
export async function processOcrJob(data: { tenantId: string; attachmentId: string }) {
  console.log(`[OCR Worker] Processing receipt ${data.attachmentId} for tenant ${data.tenantId}`);
  // In production: call ocr.service.processReceipt(data.tenantId, data.attachmentId)
}
