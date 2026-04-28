// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { MessageSquare, X, Send, Check } from 'lucide-react';
import { useCompanyContext } from '../../providers/CompanyProvider';
import { useCreateQuestion } from '../../api/hooks/usePortalQuestions';
import { Button } from '../../components/ui/Button';

interface Props {
  transactionId: string;
  // Used to render a "Re: …" context line in the modal so the
  // bookkeeper has the transaction at a glance while typing the
  // question. Optional — falls through gracefully when the caller
  // can't synthesize a one-liner.
  contextSummary?: string | null;
  // Caller's controlled disable state (e.g. void txn, no
  // active company). When true the button still renders but
  // becomes inert with an explanatory tooltip.
  disabled?: boolean;
  disabledReason?: string;
}

// Per build plan §2.5 + §10.2 — bookkeepers can ask the client a
// transaction-scoped clarifying question from any transaction
// detail view. POSTs through the existing /practice/portal/
// questions endpoint with `transactionId` set so the resulting
// thread is anchored to this row in the portal contact's view.
//
// Mirrors features/practice/close-review/AskClientButton in
// shape (modal + body + send) but targets the posted-transaction
// flow instead of the unposted bank-feed item flow. The two
// surfaces use different APIs because the close-review path is
// keyed by classification stateId, while this one is keyed by
// transactionId.
export function AskClientAboutTransactionButton({
  transactionId,
  contextSummary,
  disabled,
  disabledReason,
}: Props) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const { activeCompanyId } = useCompanyContext();
  const ask = useCreateQuestion();

  const noActiveCompany = !activeCompanyId;
  const isDisabled = !!disabled || noActiveCompany;
  const disabledTooltip = disabled
    ? disabledReason
    : noActiveCompany
      ? 'Pick a company in the sidebar before asking the client.'
      : undefined;

  const close = () => {
    if (ask.isPending) return;
    setOpen(false);
    setBody('');
    setError(null);
    setSentId(null);
  };

  const submit = () => {
    if (!body.trim()) {
      setError('Type a question for your client first.');
      return;
    }
    if (!activeCompanyId) {
      setError('Pick a company in the sidebar before sending.');
      return;
    }
    setError(null);
    ask.mutate(
      { companyId: activeCompanyId, body: body.trim(), transactionId },
      {
        onSuccess: (res) => setSentId(res.id),
        onError: (err) =>
          setError(err instanceof Error ? err.message : 'Failed to send the question.'),
      },
    );
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={isDisabled}
        title={disabledTooltip ?? 'Ask the client a question about this transaction'}
      >
        <MessageSquare className="h-4 w-4 mr-1" />
        Ask Client
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ask the client about this transaction"
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={close}
        >
          <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
          <div
            className="relative w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 className="text-base font-semibold text-gray-900">Ask the client</h2>
              <button
                type="button"
                onClick={close}
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Close"
                disabled={ask.isPending}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {sentId ? (
              <div className="space-y-3 p-4 text-sm">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Question sent.</span>
                </div>
                <p className="text-gray-600">
                  The question is now in the practice's open-questions queue and linked to
                  this transaction. The client will see it on their next portal visit (or
                  via the next reminder batch).
                </p>
                <div className="text-right">
                  <Button onClick={close} variant="primary" size="sm">
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-4">
                {contextSummary && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    Re: <span className="font-medium text-gray-800">{contextSummary}</span>
                  </div>
                )}
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-gray-600">
                    What do you need from your client?
                  </span>
                  <textarea
                    autoFocus
                    rows={5}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Could you confirm what this transaction was for?"
                    className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </label>
                {error && (
                  <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {error}
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={close} disabled={ask.isPending}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={submit}
                    disabled={ask.isPending}
                    loading={ask.isPending}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Send
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
