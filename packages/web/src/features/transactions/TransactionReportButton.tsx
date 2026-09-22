// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toaster';
import { openReportPdf } from './openReportPdf';

// Opens the Transaction Report (summary of this transaction and everything
// linked to it, followed by their attachments) in a new tab. The date-range
// version lives on Reports → Transaction Report and shares openReportPdf.
export function TransactionReportButton({ transactionId, size = 'sm' }: { transactionId: string; size?: 'sm' | 'md' }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { skippedAttachments } = await openReportPdf(`/transactions/${transactionId}/report.pdf`, {
        title: 'Transaction Report', fallbackFileName: 'transaction-report.pdf',
      });
      if (skippedAttachments > 0) {
        toast.info(`${skippedAttachments} attachment${skippedAttachments === 1 ? '' : 's'} could not be included`, {
          detail: 'The report lists each one and why.',
        });
      }
    } catch (err) {
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
