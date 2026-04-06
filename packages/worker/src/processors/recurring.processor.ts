// BullMQ recurring transaction processor stub
// Runs daily to post all due auto-mode schedules
export async function processRecurringJobs() {
  console.log('[Recurring Worker] Checking for due recurring transactions...');
  // In production: call recurring.service.processAllDue()
}
