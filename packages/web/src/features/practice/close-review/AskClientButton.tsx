// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { MessageSquare, X, Send, Check } from 'lucide-react';
import { useAskClient } from '../../../api/hooks/useClassificationState';
import { Button } from '../../../components/ui/Button';

interface Props {
  stateId: string;
  description?: string | null;
}

// Opens a question against the unposted bank-feed item using the
// portal-question backend. Per build plan §2.5 the button surface
// stays per-row; the modal collects the prompt body. When the
// tenant has portal contacts the bookkeeper can pick one to
// assign — for now we let the question sit unassigned until the
// portal admin links it (the existing question system handles
// both shapes).
export function AskClientButton({ stateId, description }: Props) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);
  const ask = useAskClient();

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
    setError(null);
    ask.mutate(
      { stateId, body: body.trim() },
      {
        onSuccess: (res) => setSentId(res.questionId),
        onError: (err) =>
          setError(err instanceof Error ? err.message : 'Failed to send the question.'),
      },
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Ask the client a question about this item"
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Ask Client
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Ask the client"
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
                  The question has been logged in the practice's open-questions queue. If the
                  client is connected to the portal they'll see it on their next visit; otherwise
                  it stays in the queue until you assign a contact.
                </p>
                <div className="text-right">
                  <Button onClick={close} variant="primary" size="sm">
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 p-4">
                {description && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    Re: <span className="font-medium text-gray-800">{description}</span>
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
                    placeholder="Could you confirm what this charge was for?"
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
