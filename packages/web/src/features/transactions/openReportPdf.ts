// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Opens a server-built PDF in a new tab — the Transaction Report for one
// transaction, or for a date range.
//
// Fetched with the session's bearer token rather than the ?_dl= download-token
// links other reports use: these reports embed attachments, and a
// download-token request is always treated as staff — it would skip a client
// user's attachment permissions.

import { API_BASE, getAccessToken, refreshAccessToken } from '../../api/client';

async function fetchPdf(path: string): Promise<Response> {
  const request = () => {
    const headers: Record<string, string> = {};
    const token = getAccessToken();
    const companyId = localStorage.getItem('activeCompanyId');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (companyId) headers['X-Company-Id'] = companyId;
    return fetch(`${API_BASE}${path}`, { headers });
  };
  const res = await request();
  // Access tokens last 15 minutes; a page left open will have an expired
  // one. Refresh once and retry.
  if (res.status === 401 && (await refreshAccessToken())) return request();
  return res;
}

export interface OpenedReport {
  /** Attachments the server could not include (it lists each one and why). */
  skippedAttachments: number;
}

/**
 * Must be called from inside a click handler: the tab is opened
 * synchronously, before the fetch, or the popup blocker eats it. Throws with
 * the server's message when the report could not be built.
 */
export async function openReportPdf(path: string, opts: { title: string; fallbackFileName: string }): Promise<OpenedReport> {
  const tab = window.open('', '_blank');
  if (tab) tab.document.title = `${opts.title}…`;
  try {
    const res = await fetchPdf(path);
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new Error(body?.error?.message || `Could not build the report (${res.status})`);
    }
    const skippedAttachments = Number(res.headers.get('X-Report-Warnings') ?? 0);
    const blobUrl = URL.createObjectURL(await res.blob());
    if (tab) {
      tab.location.href = blobUrl;
    } else {
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = opts.fallbackFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    // The tab keeps reading the blob for as long as it is open.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10 * 60 * 1000);
    return { skippedAttachments };
  } catch (err) {
    tab?.close();
    throw err;
  }
}
