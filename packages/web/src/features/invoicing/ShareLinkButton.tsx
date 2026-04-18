// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Link2, MessageSquare, Check } from 'lucide-react';
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
      {error && (
        <span role="alert" className="text-xs text-red-600 self-center">{error}</span>
      )}
    </>
  );
}
