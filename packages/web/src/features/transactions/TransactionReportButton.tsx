// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toaster';
import { API_BASE, getAccessToken, refreshAccessToken } from '../../api/client';

// Opens the Transaction Report (summary of this transaction and everything
// linked to it, followed by their attachments) in a new tab.
//
// Fetched with the session's bearer token rather than the ?_dl= download-token
// links other reports use: the report embeds attachments, and a download-token
// request is always treated as staff — it would skip a client user's
// attachment permissions.
async function fetchReport(transactionId: string): Promise<Response> {
  const request = () => {
    const headers: Record<string, string> = {};
    const token = getAccessToken();
    const companyId = localStorage.getItem('activeCompanyId');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (companyId) headers['X-Company-Id'] = companyId;
    return fetch(`${API_BASE}/transactions/${transactionId}/report.pdf`, { headers });
  };
  const res = await request();
  // Access tokens last 15 minutes; a transaction left open will have an
  // expired one. Refresh once and retry.
  if (res.status === 401 && (await refreshAccessToken())) return request();
  return res;
}

export function TransactionReportButton({ transactionId, size = 'sm' }: { transactionId: string; size?: 'sm' | 'md' }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    // Opened synchronously, inside the click, or the popup blocker eats it;
    // pointed at the PDF once it exists.
    const tab = window.open('', '_blank');
    if (tab) tab.document.title = 'Transaction Report…';
    setLoading(true);
    try {
      const res = await fetchReport(transactionId);
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message || `Could not build the report (${res.status})`);
      }
      const skipped = Number(res.headers.get('X-Report-Warnings') ?? 0);
      const blobUrl = URL.createObjectURL(await res.blob());
      if (tab) {
        tab.location.href = blobUrl;
      } else {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = 'transaction-report.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      // The tab keeps reading the blob for as long as it is open.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10 * 60 * 1000);
      if (skipped > 0) {
        toast.info(`${skipped} attachment${skipped === 1 ? '' : 's'} could not be included`, {
          detail: 'The report lists each one and why.',
        });
      }
    } catch (err) {
      tab?.close();
      toast.error(err instanceof Error ? err.message : 'Could not build the report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="secondary" size={size} onClick={handleClick} loading={loading}>
      <FileText className="h-4 w-4 mr-1" /> Transaction Report
    </Button>
  );
}
