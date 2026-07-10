// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// E-file panel for the 1099 Center. Submits the selected year's
// above-threshold, eligible, non-excluded vendors to Tax1099.com using
// the managing firm's credentials. The server enforces the submitter
// rule (super-admin / firm admin / accountant); this panel also hides
// the button when the context says the caller can't submit.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, isApiError } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Send, CheckCircle, AlertTriangle } from 'lucide-react';

interface EfileContext {
  available: boolean;
  reason: string | null;
  canSubmit: boolean;
  isEnabled: boolean;
  environment: string | null;
  firmName: string | null;
}

interface SubmitResult {
  filingId: string;
  providerReference: string;
  vendorCount: number;
  totalAmount: number;
  skipped: string[];
  environment: string;
}

export function Tax1099EfilePanel({ taxYear, formType }: { taxYear: number; formType: '1099-NEC' | '1099-MISC' }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: ctx } = useQuery({
    queryKey: ['practice', '1099', 'efile-context'],
    queryFn: () => apiClient<EfileContext>('/practice/1099/efile/context'),
  });

  const submit = useMutation({
    mutationFn: () => apiClient<SubmitResult>('/practice/1099/efile/submit', {
      method: 'POST',
      body: JSON.stringify({ taxYear, formType }),
    }),
    onSuccess: (r) => {
      setResult(r);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['practice', '1099'] });
    },
    onError: (e) => setError(isApiError(e) ? e.message : 'Submission failed'),
  });

  if (!ctx?.available) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 mb-4">
      <ConfirmDialog
        open={confirming}
        title={`Submit ${formType} filings to Tax1099?`}
        message={`This submits all eligible ${taxYear} vendors for e-filing via ${ctx.firmName || 'your firm'}'s Tax1099 account (${ctx.environment}). ${ctx.environment === 'production' ? 'These are REAL IRS filings.' : 'Sandbox — no real filings are made.'}`}
        confirmLabel="Submit filings"
        variant={ctx.environment === 'production' ? 'danger' : 'primary'}
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); submit.mutate(); }}
      />
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm">
          <p className="font-medium text-gray-900">E-file with Tax1099</p>
          {ctx.isEnabled ? (
            <p className="text-gray-500">
              Files through {ctx.firmName || 'your firm'} ({ctx.environment}). Submits every eligible,
              above-threshold vendor for {taxYear}; vendors with missing TIN or address are skipped and reported.
            </p>
          ) : (
            <p className="text-gray-500">{ctx.reason}</p>
          )}
          {error && <p className="text-red-600 mt-1 flex items-center gap-1"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</p>}
          {result && (
            <div className="text-green-700 mt-1">
              <p className="flex items-center gap-1">
                <CheckCircle className="h-4 w-4" /> Submitted {result.vendorCount} vendor(s), ${result.totalAmount.toFixed(2)} — ref {result.providerReference}
              </p>
              {result.skipped.length > 0 && (
                <p className="text-amber-700 text-xs mt-0.5">Skipped: {result.skipped.join('; ')}</p>
              )}
            </div>
          )}
        </div>
        {ctx.canSubmit && ctx.isEnabled && (
          <Button onClick={() => setConfirming(true)} loading={submit.isPending} className="whitespace-nowrap">
            <Send className="h-4 w-4 mr-1" /> Submit to Tax1099
          </Button>
        )}
      </div>
    </div>
  );
}
