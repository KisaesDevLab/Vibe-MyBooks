// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, EyeOff, MessageSquare, X } from 'lucide-react';
import type { Finding } from '@kis-books/shared';
import { Button } from '../../../../components/ui/Button';
import { useToast } from '../../../../components/ui/Toaster';
import { apiClient } from '../../../../api/client';
import { useFeatureFlag } from '../../../../api/hooks/useFeatureFlag';
import { useBulkTransitionFindings, useCreateSuppression } from '../../../../api/hooks/useReviewChecks';

interface Props {
  selectedIds: string[];
  selectedFindings: Finding[];
  onCleared: () => void;
  companyId: string | null;
}

const DEFAULT_QUESTION = 'Can you tell us what this transaction was for?';

// Actions on the selected rows, Double-style:
//   Accept         — reviewed and fine for this month (resolved).
//   Dismiss        — not an issue (ignored).
//   Exclude payee  — never flag this payee in this report again for this
//                    client (a suppression), and dismiss the rows.
//   Ask the client — one portal question per transaction, delivered in the
//                    client's batched reminder rather than immediately.
// High/critical rows need a note to accept or dismiss (server-enforced too).
export function FindingsBulkBar({ selectedIds, selectedFindings, onCleared, companyId }: Props) {
  const bulk = useBulkTransitionFindings();
  const suppress = useCreateSuppression();
  const qc = useQueryClient();
  const toast = useToast();
  const portalOn = useFeatureFlag('CLIENT_PORTAL_V1') === true;
  const [note, setNote] = useState('');
  const [asking, setAsking] = useState(false);
  const requiresNote = selectedFindings.some(
    (f) => f.severity === 'high' || f.severity === 'critical',
  );

  if (selectedIds.length === 0) return null;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['practice', 'checks'] });
  };

  const apply = (status: 'resolved' | 'ignored', ids = selectedIds, defaultNote?: string) => {
    const text = note.trim() || defaultNote || '';
    if (requiresNote && !text) {
      toast.error(status === 'resolved'
        ? 'High and critical rows need a note to accept.'
        : 'High and critical rows need a reason to dismiss.');
      return;
    }
    bulk.mutate(
      {
        ids,
        status,
        note: text || undefined,
        resolutionNote: status === 'resolved' ? text || (requiresNote ? undefined : 'Accepted') : undefined,
      },
      {
        onSuccess: () => { invalidate(); },
        onError: (e: Error) => toast.error(e.message || 'Could not update the rows.'),
        onSettled: () => { setNote(''); onCleared(); },
      },
    );
  };

  // Rows with a payee can be excluded; one suppression per (report, payee).
  const payeeRows = selectedFindings.filter((f) => f.vendorId);
  const excludePayees = async () => {
    const pairs = new Map<string, { checkKey: string; vendorId: string }>();
    for (const f of payeeRows) pairs.set(`${f.checkKey}:${f.vendorId}`, { checkKey: f.checkKey, vendorId: f.vendorId! });
    try {
      for (const p of pairs.values()) {
        await suppress.mutateAsync({
          checkKey: p.checkKey,
          companyId,
          matchPattern: { vendorId: p.vendorId },
          reason: note.trim() || 'Excluded from this report during close review',
        });
      }
      apply('ignored', payeeRows.map((f) => f.id), 'Payee excluded from this report');
      toast.success(`Excluded ${pairs.size} payee${pairs.size === 1 ? '' : 's'} from future runs of this report.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not exclude the payee.');
    }
  };

  const txnRows = selectedFindings.filter((f) => f.transactionId);
  const askClient = async () => {
    if (!companyId || txnRows.length === 0) return;
    setAsking(true);
    try {
      const ids = [...new Set(txnRows.map((f) => f.transactionId!))];
      const r = await apiClient<{ created: number }>('/practice/portal/questions/bulk', {
        method: 'POST',
        body: JSON.stringify({ companyId, body: note.trim() || DEFAULT_QUESTION, transactionIds: ids }),
      });
      toast.success(`Asked the client about ${r.created} transaction${r.created === 1 ? '' : 's'}. They get it in their next reminder.`);
      setNote('');
      onCleared();
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not ask the client.');
    } finally {
      setAsking(false);
    }
  };

  const busy = bulk.isPending || suppress.isPending || asking;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
      <div className="text-sm text-indigo-900">
        <span className="font-medium">{selectedIds.length}</span>
        {' selected'}
        {requiresNote && (
          <span className="ml-2 text-xs text-rose-700">
            (note required for high/critical)
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={requiresNote ? 'Note (required)' : 'Note, or the question for the client'}
          aria-label="Note or question"
          className="w-64 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm"
        />
        <Button variant="primary" size="sm" onClick={() => apply('resolved')} disabled={busy}>
          <CheckCircle2 className="mr-1 h-4 w-4" />
          Accept
        </Button>
        <Button variant="secondary" size="sm" onClick={() => apply('ignored')} disabled={busy}>
          <EyeOff className="mr-1 h-4 w-4" />
          Dismiss
        </Button>
        {payeeRows.length > 0 && (
          <Button variant="secondary" size="sm" onClick={() => void excludePayees()} disabled={busy}
            title="Stop flagging these payees in this report for this client">
            <Ban className="mr-1 h-4 w-4" />
            Exclude payee
          </Button>
        )}
        {portalOn && companyId && txnRows.length > 0 && (
          <Button variant="secondary" size="sm" onClick={() => void askClient()} disabled={busy}
            title="Send each transaction to the client portal as a question">
            <MessageSquare className="mr-1 h-4 w-4" />
            Ask the client
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onCleared} disabled={busy}>
          <X className="mr-1 h-4 w-4" />
          Clear
        </Button>
      </div>
    </div>
  );
}
