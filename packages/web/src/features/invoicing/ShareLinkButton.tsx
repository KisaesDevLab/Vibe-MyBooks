// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Link2, Link2Off, MessageSquare, Check } from 'lucide-react';
import { apiClient } from '../../api/client';

interface Props {
  invoiceId: string;
  invoiceNumber?: string;
  total?: string;
  contactPhone?: string;
}

export function ShareLinkButton({ invoiceId, invoiceNumber, total, contactPhone }: Props) {
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [error, setError] = useState('');

  const isMobile = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(''), 4000);
    return () => clearTimeout(t);
  }, [error]);

  async function getOrCreateLink(): Promise<string> {
    if (shareLink) return shareLink;
    const res = await apiClient<{ link: string }>(`/invoices/${invoiceId}/share-link`, { method: 'POST' });
    setShareLink(res.link);
    return res.link;
  }

  const handleCopyLink = async () => {
    setLoading(true);
    setError('');
    try {
      const link = await getOrCreateLink();
      // navigator.clipboard requires HTTPS — fall back to execCommand for HTTP
      try {
        await navigator.clipboard.writeText(link);
      } catch {
        const textarea = document.createElement('textarea');
        textarea.value = link;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate link');
    }
    setLoading(false);
  };

  // DELETE …/share-link kills the issued public token: whoever holds the
  // old URL gets 404; the next "Copy Link" mints a fresh one.
  const handleRevokeLink = async () => {
    if (!window.confirm('Revoke the public link for this invoice? Anyone who has the current link will lose access.')) return;
    setLoading(true);
    setError('');
    try {
      await apiClient(`/invoices/${invoiceId}/share-link`, { method: 'DELETE' });
      setShareLink(null);
      setRevoked(true);
      setTimeout(() => setRevoked(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke link');
    }
    setLoading(false);
  };

  const handleTextLink = async () => {
    setLoading(true);
    setError('');
    try {
      const link = await getOrCreateLink();
      const formattedTotal = parseFloat(total || '0').toFixed(2);
      const msg = `Invoice ${invoiceNumber || ''} for $${formattedTotal}: ${link}`;
      const phone = contactPhone || '';
      window.location.href = `sms:${phone}?body=${encodeURIComponent(msg)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate link');
    }
    setLoading(false);
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handleCopyLink} loading={loading}>
        {copied
          ? <><Check className="h-4 w-4 mr-1 text-green-600" /> Copied</>
          : <><Link2 className="h-4 w-4 mr-1" /> Copy Link</>
        }
      </Button>
      {isMobile && (
        <Button variant="secondary" size="sm" onClick={handleTextLink} loading={loading}>
          <MessageSquare className="h-4 w-4 mr-1" /> Text Link
        </Button>
      )}
      <Button variant="secondary" size="sm" onClick={handleRevokeLink} loading={loading} title="Revoke the public link (a new one is minted on the next Copy Link)">
        {revoked
          ? <><Check className="h-4 w-4 mr-1 text-green-600" /> Link revoked</>
          : <><Link2Off className="h-4 w-4 mr-1" /> Revoke Link</>
        }
      </Button>
      {error && (
        <span role="alert" className="text-xs text-red-600 self-center">{error}</span>
      )}
    </>
  );
}
