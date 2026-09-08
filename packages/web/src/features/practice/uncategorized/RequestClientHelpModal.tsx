// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// "Ask the client for help" — email and/or text the portal contacts who may
// suggest categories for this company, asking them to log in and answer
// "What was this?" for the rows sitting in suspense.
//
// The screen exists mostly to stop three silent failures: sending to a
// contact who has no tick and would find nothing; sending while the portal
// flag is off, which is the same thing tenant-wide; and sending when the
// portal queue is empty because the suspense account is not tagged. Each of
// those is shown before the button, not discovered by the client.

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Mail, MessageSquareText, Send, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toaster';
import { ApiError } from '../../../api/client';
import {
  useHelpRecipients, useSendHelpRequest,
  type HelpChannel, type HelpOutcome, type HelpSendResult,
} from '../../../api/hooks/useUncategorized';

interface Props {
  open: boolean;
  onClose: () => void;
}

const OUTCOME_COPY: Record<HelpOutcome, string> = {
  sent: 'sent',
  suppressed: 'opted out (STOP)',
  no_phone: 'no phone number',
  sms_disabled: 'texts unavailable',
  error: 'failed',
};

function relative(iso: string | null): string {
  if (!iso) return 'never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

export function RequestClientHelpModal({ open, onClose }: Props) {
  const toast = useToast();
  const closeRef = useRef<HTMLButtonElement>(null);
  const recipients = useHelpRecipients(open);
  const send = useSendHelpRequest();

  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [channels, setChannels] = useState<Set<HelpChannel>>(new Set(['email']));
  const [note, setNote] = useState('');
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [result, setResult] = useState<HelpSendResult | null>(null);

  const view = recipients.data;
  const contacts = useMemo(() => view?.contacts ?? [], [view]);

  // Everyone eligible is ticked by default; the list is short by nature.
  useEffect(() => {
    if (!open) return;
    setChosen(new Set(contacts.map((c) => c.contactId)));
    setResult(null);
    setConfirmEmpty(false);
  }, [open, contacts]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggleContact = (id: string) => setChosen((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleChannel = (ch: HelpChannel) => setChannels((prev) => {
    const next = new Set(prev);
    if (next.has(ch)) next.delete(ch); else next.add(ch);
    return next;
  });

  const queueEmpty = (view?.queueCount ?? 0) === 0;
  const blocked = !view || !view.portalEnabled || contacts.length === 0;
  const canSend = !blocked && chosen.size > 0 && channels.size > 0 && (!queueEmpty || confirmEmpty) && !send.isPending;

  const submit = () => {
    if (!canSend) return;
    send.mutate(
      {
        contactIds: [...chosen],
        channels: [...channels],
        note: note.trim() || undefined,
        confirmEmpty: queueEmpty ? true : undefined,
      },
      {
        onSuccess: (res) => {
          setResult(res);
          const sent = res.results.flatMap((r) => r.outcomes).filter((o) => o.outcome === 'sent').length;
          if (sent > 0) toast.success(`Sent ${sent} message(s).`);
          else toast.error('Nothing was sent. See the outcomes below.');
        },
        onError: (e) => {
          const msg = e instanceof ApiError && e.code === 'PORTAL_QUEUE_EMPTY'
            ? 'The client\'s "What was this?" page is empty right now. Tick the confirmation to send anyway.'
            : e instanceof Error ? e.message : 'Could not send.';
          toast.error(msg);
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Ask the client for help categorizing"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Ask the client for help</h2>
            <p className="text-xs text-gray-500">
              Email or text the people who can answer &ldquo;What was this?&rdquo; in the portal
              {view?.companyName ? ` for ${view.companyName}` : ''}.
            </p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-gray-500 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm">
          {recipients.isLoading && (
            <p className="flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
          )}
          {recipients.isError && (
            <p className="text-red-600">
              Could not load recipients. <button className="underline" onClick={() => recipients.refetch()}>Retry</button>
            </p>
          )}

          {view && !view.portalEnabled && (
            <Warn>
              Clients cannot see the categorize page for this firm yet. Turn on
              <strong> PORTAL_CATEGORIZE_V1</strong> for the tenant first, or they will log in to nothing.
            </Warn>
          )}
          {view && view.portalEnabled && contacts.length === 0 && (
            <Warn>
              No portal contact for this client has <strong>Can suggest categories</strong> ticked.
              Tick it on Practice → Client Portal, then come back here.
            </Warn>
          )}
          {view && view.portalEnabled && contacts.length > 0 && queueEmpty && (
            <Warn>
              The client&rsquo;s &ldquo;What was this?&rdquo; page is <strong>empty</strong> right now, so they would
              log in and find nothing. That happens when the rows here sit in an account that is not
              the tagged suspense account.
              <label className="mt-2 flex items-center gap-2 font-normal">
                <input type="checkbox" checked={confirmEmpty} onChange={(e) => setConfirmEmpty(e.target.checked)} />
                Send anyway
              </label>
            </Warn>
          )}
          {view && view.portalEnabled && contacts.length > 0 && !queueEmpty && (
            <p className="text-gray-600">
              They will see <strong>{view.queueCount}</strong> transaction(s) waiting for an answer.
            </p>
          )}

          {contacts.length > 0 && (
            <fieldset className="space-y-1">
              <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">Send to</legend>
              {contacts.map((c) => (
                <label key={c.contactId} className="flex items-start gap-2 rounded px-1 py-1 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={chosen.has(c.contactId)}
                    onChange={() => toggleContact(c.contactId)}
                    aria-label={`Send to ${c.name}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-gray-900">{c.name}</span>
                    <span className="block truncate text-xs text-gray-500">
                      {c.email}{c.phone ? ` · ${c.phone}` : ' · no phone'}
                      {c.emailSuppressed && ' · email opted out'}
                      {c.smsSuppressed && !c.emailSuppressed && ' · texts opted out'}
                    </span>
                    <span className="block text-xs text-gray-400">
                      Last asked {relative(c.lastAskedAt)} · last in portal {relative(c.lastSeenAt)}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          <fieldset>
            <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">How</legend>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" checked={channels.has('email')} onChange={() => toggleChannel('email')} />
                <Mail className="h-4 w-4 text-gray-500" /> Email
              </label>
              <label
                className={`inline-flex items-center gap-1.5 ${view && !view.smsAvailable ? 'text-gray-400' : ''}`}
                title={view?.smsUnavailableReason ?? undefined}
              >
                <input
                  type="checkbox"
                  checked={channels.has('sms')}
                  onChange={() => toggleChannel('sms')}
                  disabled={!!view && !view.smsAvailable}
                />
                <MessageSquareText className="h-4 w-4 text-gray-500" /> Text message
              </label>
            </div>
            {view && !view.smsAvailable && view.smsUnavailableReason && (
              <p className="mt-1 text-xs text-gray-500">{view.smsUnavailableReason}</p>
            )}
          </fieldset>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
              Add a note <span className="normal-case font-normal">(optional)</span>
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 1000))}
              rows={3}
              placeholder="Mostly the checks from August — anything you remember helps."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          {result && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
              <div className="mb-1 font-medium text-gray-700">Outcome</div>
              <ul className="space-y-0.5">
                {result.results.map((r) => (
                  <li key={r.contactId} className="text-gray-700">
                    <span className="font-medium">{r.name}</span>:{' '}
                    {r.outcomes.map((o) => `${o.channel === 'sms' ? 'text' : 'email'} ${OUTCOME_COPY[o.outcome]}${o.error ? ` (${o.error})` : ''}`).join(', ')}
                  </li>
                ))}
                {result.notEligible.length > 0 && (
                  <li className="text-amber-700">
                    {result.notEligible.length} contact(s) skipped: no longer allowed to suggest categories.
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <Button variant="secondary" onClick={onClose}>{result ? 'Done' : 'Cancel'}</Button>
          {!result && (
            <Button onClick={submit} disabled={!canSend}>
              {send.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              Send request
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
      <div>{children}</div>
    </div>
  );
}
