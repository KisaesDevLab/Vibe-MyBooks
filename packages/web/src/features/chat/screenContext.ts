/**
 * Convert the React Router location into a stable screen identifier
 * we send to the chat backend. The IDs match the keys in
 * chat.service.SUGGESTIONS_BY_SCREEN so the assistant gets relevant
 * quick-action suggestions for the current page.
 *
 * Update this map when adding new screens that should have specific
 * suggestions or context-aware help.
 */

export interface ScreenContext {
  screenId: string;
  path: string;
  entityType?: string;
  entityId?: string;
}

const PATH_PATTERNS: Array<{
  pattern: RegExp;
  screenId: string;
  entityType?: string;
}> = [
  // Bills / AP
  { pattern: /^\/bills\/new$/, screenId: 'enter-bill' },
  { pattern: /^\/bills\/([^/]+)\/edit$/, screenId: 'enter-bill', entityType: 'bill' },
  { pattern: /^\/bills\/([^/]+)$/, screenId: 'bills', entityType: 'bill' },
  { pattern: /^\/bills$/, screenId: 'bills' },
  { pattern: /^\/pay-bills$/, screenId: 'pay-bills' },
  { pattern: /^\/print-checks$/, screenId: 'print-checks' },
  { pattern: /^\/vendor-credits/, screenId: 'vendor-credits' },

  // Banking
  { pattern: /^\/banking\/feed$/, screenId: 'bank-feed' },
  { pattern: /^\/banking\/reconciliation/, screenId: 'reconciliation' },
  { pattern: /^\/banking/, screenId: 'banking' },

  // Sales / AR
  { pattern: /^\/invoices\/new$/, screenId: 'enter-invoice' },
  { pattern: /^\/invoices\/([^/]+)\/edit$/, screenId: 'enter-invoice', entityType: 'invoice' },
  { pattern: /^\/invoices\/([^/]+)$/, screenId: 'invoices', entityType: 'invoice' },
  { pattern: /^\/invoices$/, screenId: 'invoices' },
  { pattern: /^\/payments/, screenId: 'payments' },

  // Reports
  { pattern: /^\/reports/, screenId: 'reports' },

  // Other
  { pattern: /^\/transactions/, screenId: 'transactions' },
  { pattern: /^\/contacts/, screenId: 'contacts' },
  { pattern: /^\/accounts/, screenId: 'accounts' },
  { pattern: /^\/$/, screenId: 'dashboard' },
];

export function deriveScreenContext(pathname: string): ScreenContext {
  for (const { pattern, screenId, entityType } of PATH_PATTERNS) {
    const match = pathname.match(pattern);
    if (match) {
      const ctx: ScreenContext = { screenId, path: pathname };
      if (entityType && match[1]) {
        ctx.entityType = entityType;
        ctx.entityId = match[1];
      }
      return ctx;
    }
  }
  return { screenId: 'unknown', path: pathname };
}
