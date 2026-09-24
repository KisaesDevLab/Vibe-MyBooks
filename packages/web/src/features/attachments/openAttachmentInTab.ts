// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Open an attachment (a bank statement PDF, a receipt) in a new browser tab.
//
// window.open cannot carry an Authorization header, so the tab is pointed at
// the download route with a single-use, short-lived download token from
// POST /downloads/token — the same pattern ReportShell uses for report PDFs.
// `inline=1` asks for Content-Disposition: inline so the browser shows the
// PDF instead of saving it. Staff-side surfaces only: the download-token
// route is issued to the signed-in staff session.

import { apiClient, API_BASE } from '../../api/client';

export async function openAttachmentInTab(attachmentId: string): Promise<void> {
  const { token } = await apiClient<{ token: string; expiresIn: number }>(
    '/downloads/token', { method: 'POST', body: JSON.stringify({}) },
  );
  window.open(
    `${API_BASE}/attachments/${attachmentId}/download?inline=1&_dl=${encodeURIComponent(token)}`,
    '_blank', 'noopener',
  );
}
