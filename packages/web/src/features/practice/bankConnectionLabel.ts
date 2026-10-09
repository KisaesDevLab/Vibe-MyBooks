// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// A bank connection as /practice/bank-connections returns it, for the
// statement-routing pickers (doc-request rule / one-off request editor
// and the receipts-inbox "Route statement" dialog).
export interface BankConnectionOption {
  id: string;
  institutionName: string | null;
  mask: string | null;
  companyId: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  accountType?: string | null;
}

// Lead with the GL account the rows will land in. Manual connections are
// all named "Statement Import" with no mask, so the institution alone made
// every option look the same (a card statement got bound to Cash).
export function bankConnectionLabel(c: BankConnectionOption): string {
  const account = [c.accountNumber, c.accountName].filter(Boolean).join(' — ');
  const source = `${c.institutionName ?? 'Bank connection'}${c.mask ? ` ····${c.mask}` : ''}`;
  return account ? `${account} (${source})` : source;
}
