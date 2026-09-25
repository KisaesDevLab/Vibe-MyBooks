// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// PORTAL_CATEGORIZE_V1 — "What was this?" for the client.
//
// Answers are SUGGESTIONS. Nothing posts to the books from this page; the
// bookkeeper approves, overrides or sends each one back, and the copy says so
// plainly so nobody thinks they have just edited the ledger.
//
// Mobile first: this is the page someone works through on a phone.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, HelpCircle, Loader2, Paperclip, Save, Send, Trash2, Upload, User } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { usePortal } from './PortalLayout';

interface QueueItem {
  targetKind: 'bank_feed_item' | 'transaction';
  targetId: string;
  date: string;
  description: string;
  /** The bank's own wording for the line, when the row came from a bank feed. */
  bankDescription?: string | null;
  amount: string;
  direction: 'money_out' | 'money_in';
  existingSuggestion: {
    id: string; status: string; label: string | null;
    note: string | null; payeeLabel?: string | null; rejectionReason: string | null;
  } | null;
  /** Files this client has already sent for the row. */
  myAttachmentCount: number;
}

interface AttachedFile {
  id: string; fileName: string; mimeType: string | null;
  fileSize: number | null; uploadedAt: string;
}

interface Category { id: string; label: string; group: string; hint: string | null }
interface Payee { id: string; label: string; kind: string }

// The payee select's "not in the list" choice, which reveals a text box.
const OTHER_PAYEE = '__other';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

// Must stay in step with ATTACH_MIME_TYPES in
// packages/api/src/routes/portal-categorize-public.routes.ts. Narrower than
// the staff allowlist on purpose: a phone photo or a PDF, nothing else.
const ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,image/heic,application/pdf';
const MAX_FILE_MB = 10;

// The two answers that are not an account. Resolved server-side so the client
// never sees an equity account, and "not sure" routes a note to a human.
const PERSONAL = 'personal';
const NOT_SURE = 'not_sure';

// Why the server turned a row down, in words a client can act on.
const FAILURE_COPY: Record<string, string> = {
  not_found: 'one is no longer on your list',
  invalid_category: 'a category is no longer available',
  note_required: 'a note is needed',
  invalid_payee: 'a payee is no longer available',
  already_answered: 'one was already answered',
  write_failed: 'one could not be saved',
};

class SaveError extends Error {}

// Say WHY a save failed. The old copy ("Could not send your answers") was the
// same for an expired sign-in, staff preview mode, and a server fault.
export function describeSaveFailure(status: number, code?: string): string {
  if (status === 401) return 'You were signed out. Sign in again to save — copy anything long you typed first.';
  if (code === 'PREVIEW_READ_ONLY') return 'This is a staff preview, so answers are not saved. Your client can save from their own sign-in.';
  if (code === 'FEATURE_DISABLED') return 'Answering is turned off for your account. Contact your bookkeeper.';
  if (status === 403) return 'You do not have access to answer for this business.';
  if (status === 429) return 'Too many saves in a row. Wait a minute, then save again — what you typed is still here.';
  if (status === 400) return 'That answer could not be read. Check it and save again.';
  return 'Something went wrong on our side. Save again in a moment — what you typed is still here.';
}

export function PortalCategorizePage() {
  const { activeCompanyId, me } = usePortal();
  // Staff previewing the portal cannot save (the server refuses). Say so up
  // front instead of letting the Save buttons fail.
  const isPreview = !!me?.preview;
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Per row: a contact id from the list, or OTHER_PAYEE with a typed name.
  const [payeePicks, setPayeePicks] = useState<Record<string, string>>({});
  const [payeeLabels, setPayeeLabels] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  // Per-card save: which card is saving, and a message on a card whose save
  // did not go through (kept on the card, never replacing the list).
  const [savingId, setSavingId] = useState<string | null>(null);
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({});
  const [sentCount, setSentCount] = useState(0);
  // Inline, non-fatal messages: a row that needs a note, or rows the server
  // turned down. Distinct from `error`, which replaces the whole list.
  const [notice, setNotice] = useState<string | null>(null);

  const base = import.meta.env.BASE_URL;

  const load = useCallback(async () => {
    if (!activeCompanyId) return;
    setItems(null); setError(null); setRetryable(false);
    try {
      const [qRes, cRes, pRes] = await Promise.all([
        fetch(`${base}api/portal/categorize/queue?companyId=${activeCompanyId}`, { credentials: 'include' }),
        fetch(`${base}api/portal/categorize/categories?companyId=${activeCompanyId}`, { credentials: 'include' }),
        fetch(`${base}api/portal/categorize/payees?companyId=${activeCompanyId}`, { credentials: 'include' }),
      ]);
      // 403 and flag-off are access states, not transient failures, so they
      // get no Retry button — the same posture as the banking page.
      if (qRes.status === 403 || cRes.status === 403 || pRes.status === 403) {
        setError('Categorizing is not enabled for your account.');
        return;
      }
      if (!qRes.ok || !cRes.ok || !pRes.ok) throw new Error(`HTTP ${qRes.status}/${cRes.status}/${pRes.status}`);
      const q = await qRes.json();
      const c = await cRes.json();
      const p = await pRes.json();
      if (q.featureEnabled === false || c.featureEnabled === false) {
        setError('Categorizing is not enabled for your account.');
        return;
      }
      setItems(q.items ?? []);
      setCategories(c.categories ?? []);
      setPayees(p.payees ?? []);
    } catch {
      setError('Could not load your transactions.');
      setRetryable(true);
    }
  }, [activeCompanyId, base]);

  useEffect(() => { void load(); }, [load, attempt]);

  // The payee answer for a row: a contact id, a typed name, or nothing.
  const payeeFor = (targetId: string): { contactId?: string; contactLabel?: string } => {
    const pick = payeePicks[targetId];
    if (pick === OTHER_PAYEE) {
      const label = payeeLabels[targetId]?.trim();
      return label ? { contactLabel: label } : {};
    }
    return pick ? { contactId: pick } : {};
  };

  // A row is ready to send if it has a category, a note, OR a payee. A note
  // on its own is a real answer — "I do not know the account, but here is
  // what it was" — and so is a payee: "paid to Home Depot" is the missing
  // fact. Either goes up as "I am not sure", which is exactly that meaning.
  const readyIds = Array.from(new Set([
    ...Object.entries(picks).filter(([, v]) => v).map(([k]) => k),
    ...Object.entries(notes).filter(([, v]) => v.trim()).map(([k]) => k),
    ...Object.keys(payeePicks).filter((k) => Object.keys(payeeFor(k)).length > 0),
  ]));
  const answered = readyIds.length;

  // Refresh the queue without blanking the page (a per-card save must not
  // flash a spinner over everything the client is still typing).
  const refreshQueue = useCallback(async () => {
    if (!activeCompanyId) return;
    try {
      const res = await fetch(`${base}api/portal/categorize/queue?companyId=${activeCompanyId}`, { credentials: 'include' });
      if (!res.ok) return;
      const q = await res.json();
      setItems(q.items ?? []);
    } catch { /* the saved answer still shows after the next full load */ }
  }, [activeCompanyId, base]);

  const payloadFor = (targetId: string) => {
    const item = (items ?? []).find((i) => i.targetId === targetId)!;
    return {
      targetKind: item.targetKind,
      targetId,
      categoryId: picks[targetId] || NOT_SURE,
      note: notes[targetId]?.trim() || undefined,
      ...payeeFor(targetId),
    };
  };
  const needsNoteFor = (p: ReturnType<typeof payloadFor>) =>
    p.categoryId === NOT_SURE && !p.note && !p.contactId && !p.contactLabel;

  // Save the given cards. Returns true when every one was accepted.
  const submit = async (targetIds: string[], opts: { single: boolean }): Promise<boolean> => {
    if (targetIds.length === 0 || !activeCompanyId) return false;
    const payload = targetIds.map(payloadFor);

    // The server refuses "not sure" with neither a note nor a payee. Say so
    // here instead, so the client is not told "sent 0 answers" with no reason.
    const needsNote = payload.filter(needsNoteFor);
    if (needsNote.length > 0) {
      const msg = 'Add a note saying what you do know, or say who it was paid to.';
      if (opts.single) {
        setCardErrors((m) => ({ ...m, [targetIds[0]!]: msg }));
      } else {
        setNotice(needsNote.length === 1
          ? 'One answer says "I am not sure" — add a note saying what you do know, or say who it was paid to.'
          : `${needsNote.length} answers say "I am not sure" — add a note to each saying what you do know, or say who it was paid to.`);
      }
      return false;
    }

    setNotice(null);
    setCardErrors((m) => {
      const next = { ...m };
      for (const id of targetIds) delete next[id];
      return next;
    });
    try {
      const res = await fetch(`${base}api/portal/categorize/suggestions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: activeCompanyId, items: payload }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null) as { error?: { code?: string } } | null;
        throw new SaveError(describeSaveFailure(res.status, body?.error?.code));
      }
      const body = await res.json();
      const accepted: string[] = body.accepted ?? [];
      const rejected: Array<{ targetId: string; reason: string }> = body.failed ?? [];
      setSentCount((c) => c + accepted.length);

      // Per-row outcomes: a rejected row used to vanish silently, leaving the
      // client to believe an answer had gone in when it had not.
      if (rejected.length > 0) {
        setCardErrors((m) => {
          const next = { ...m };
          for (const f of rejected) next[f.targetId] = `Not saved: ${FAILURE_COPY[f.reason] ?? 'it could not be saved'}.`;
          return next;
        });
        if (!opts.single) {
          const reasons = [...new Set(rejected.map((f) => FAILURE_COPY[f.reason] ?? 'could not be saved'))];
          setNotice(
            `${rejected.length} answer${rejected.length === 1 ? '' : 's'} did not go through (${reasons.join('; ')}). ` +
            'Your other answers were saved.',
          );
        }
      }

      // Drop the drafts that went in; keep everything else the client typed.
      const done = new Set(targetIds.filter((id) => !rejected.some((f) => f.targetId === id)));
      const prune = (m: Record<string, string>) =>
        Object.fromEntries(Object.entries(m).filter(([k]) => !done.has(k)));
      setPicks(prune); setNotes(prune); setPayeePicks(prune); setPayeeLabels(prune);
      await refreshQueue();
      return rejected.length === 0;
    } catch (e) {
      // Never replace the list: the drafts stay on screen, with the reason.
      const msg = e instanceof SaveError ? e.message : 'Could not reach the server. Check your connection and try again — what you typed is still here.';
      if (opts.single) setCardErrors((m) => ({ ...m, [targetIds[0]!]: msg }));
      else setNotice(msg);
      return false;
    }
  };

  const saveOne = async (targetId: string) => {
    setSavingId(targetId);
    try { await submit([targetId], { single: true }); } finally { setSavingId(null); }
  };

  const send = async () => {
    setSending(true);
    try { await submit(readyIds, { single: false }); } finally { setSending(false); }
  };

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {error}
          {retryable && (
            <button className="ml-2 underline" onClick={() => setAttempt((a) => a + 1)}>Retry</button>
          )}
        </div>
      </div>
    );
  }

  if (items === null) {
    return <div className="mx-auto max-w-3xl px-4 py-10"><LoadingSpinner /></div>;
  }

  const grouped = categories.reduce<Record<string, Category[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});
  // Every active contact on every row (user decision): a refund can come
  // from a vendor and a payment can go to a customer.
  const payeeGroups: Array<[string, Payee[]]> = [
    ['Vendors', payees.filter((p) => p.kind === 'vendor' || p.kind === 'both')],
    ['Customers', payees.filter((p) => p.kind === 'customer' || p.kind === 'both')],
    ['Other', payees.filter((p) => p.kind === 'other')],
  ].filter((g): g is [string, Payee[]] => (g[1] as Payee[]).length > 0) as Array<[string, Payee[]]>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-28">
      <header className="mb-4 space-y-1">
        <h1 className="text-xl font-semibold text-gray-900">What was this?</h1>
        <p className="text-sm text-gray-600">
          Your bookkeeper could not tell what these were for. Pick the closest match, or just
          leave a note saying what it was. Nothing you enter here changes your books on its own.
        </p>
      </header>

      {isPreview && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          You are previewing as staff. You can look around, but answers are not saved.
        </div>
      )}

      {notice && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {sentCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <Check className="h-4 w-4" />
          Saved {sentCount} answer{sentCount === 1 ? '' : 's'} for your bookkeeper.
        </div>
      )}

      {items.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          Nothing needs your input right now.
        </div>
      )}

      <ul className="space-y-3">
        {items.map((item) => {
          const already = item.existingSuggestion;
          const pick = picks[item.targetId] ?? '';
          return (
            <li key={item.targetId} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">{item.description}</div>
                  {/* The line as it reads on the client's own statement —
                      the cleaned name above is often not what they remember. */}
                  {item.bankDescription && item.bankDescription !== item.description && (
                    <div className="text-xs text-gray-600 break-words">
                      <span className="text-gray-400">On your statement:</span> {item.bankDescription}
                    </div>
                  )}
                  <div className="text-xs text-gray-500">{item.date}</div>
                </div>
                <div className={`text-lg font-semibold tabular-nums ${
                  item.direction === 'money_in' ? 'text-green-700' : 'text-gray-900'
                }`}>
                  {item.direction === 'money_in' ? '+' : '-'}
                  {money.format(Math.abs(Number(item.amount)))}
                </div>
              </div>

              {already ? (
                <div className="mt-3 rounded bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  You said <strong>{already.label}</strong>
                  {already.payeeLabel && <> · paid to/from <strong>{already.payeeLabel}</strong></>}.{' '}
                  {already.status === 'pending' && 'Waiting for your bookkeeper.'}
                  {/* Read the note back. Without it a client cannot tell what
                      it already told the bookkeeper, and re-answers to add
                      one thing it thinks it forgot. */}
                  {already.note && (
                    <p className="mt-1 border-l-2 border-gray-300 pl-2 text-xs italic text-gray-600">
                      “{already.note}”
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <label className="sr-only" htmlFor={`cat-${item.targetId}`}>Category</label>
                  <select
                    id={`cat-${item.targetId}`}
                    value={pick}
                    onChange={(e) => setPicks((p) => ({ ...p, [item.targetId]: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                  >
                    {/* Says what to do, not "Choose…": picking from the list
                        and writing a note are both complete answers here. */}
                    <option value="">Select a category or enter a note</option>
                    {Object.entries(grouped).map(([group, list]) => (
                      <optgroup key={group} label={group}>
                        {list.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                      </optgroup>
                    ))}
                    <optgroup label="Other">
                      <option value={PERSONAL}>Personal, not business</option>
                      <option value={NOT_SURE}>I am not sure</option>
                    </optgroup>
                  </select>

                  {/* Who it was paid to or came from. Optional; a name on
                      its own is a complete answer. "Someone not in this
                      list…" reveals a text box for a name staff will match. */}
                  <label className="sr-only" htmlFor={`payee-${item.targetId}`}>Who was it paid to or from?</label>
                  <select
                    id={`payee-${item.targetId}`}
                    value={payeePicks[item.targetId] ?? ''}
                    onChange={(e) => setPayeePicks((p) => ({ ...p, [item.targetId]: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Who was it paid to or from? (optional)</option>
                    {payeeGroups.map(([group, list]) => (
                      <optgroup key={group} label={group}>
                        {list.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                      </optgroup>
                    ))}
                    <option value={OTHER_PAYEE}>Someone not in this list…</option>
                  </select>
                  {payeePicks[item.targetId] === OTHER_PAYEE && (
                    <>
                      <label className="sr-only" htmlFor={`payee-name-${item.targetId}`}>Their name</label>
                      <input
                        id={`payee-name-${item.targetId}`}
                        type="text"
                        maxLength={120}
                        value={payeeLabels[item.targetId] ?? ''}
                        onChange={(e) => setPayeeLabels((l) => ({ ...l, [item.targetId]: e.target.value }))}
                        placeholder="Type their name"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                      <p className="text-xs text-gray-500">A name on its own is fine — your bookkeeper will match it.</p>
                    </>
                  )}

                  {/* Always available, never gated on picking a category.
                      A client who cannot name the account very often CAN say
                      what the payment was for, and that note is the useful
                      half. On its own it goes up as "I am not sure". */}
                  <label className="sr-only" htmlFor={`note-${item.targetId}`}>
                    Note for your bookkeeper
                  </label>
                  <textarea
                    id={`note-${item.targetId}`}
                    rows={2}
                    value={notes[item.targetId] ?? ''}
                    onChange={(e) => setNotes((n) => ({ ...n, [item.targetId]: e.target.value }))}
                    placeholder={pick === NOT_SURE && Object.keys(payeeFor(item.targetId)).length === 0
                      ? 'Tell your bookkeeper what you do know (required unless you named who it was)'
                      : 'Add a note for your bookkeeper (optional)'}
                    maxLength={2000}
                    className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />

                  {pick === PERSONAL && (
                    <p className="flex items-start gap-1.5 text-xs text-gray-500">
                      <User className="mt-0.5 h-3 w-3 shrink-0" />
                      Your bookkeeper will record this as a personal draw.
                    </p>
                  )}
                  {pick === NOT_SURE && (
                    <p className="flex items-start gap-1.5 text-xs text-gray-500">
                      <HelpCircle className="mt-0.5 h-3 w-3 shrink-0" />
                      That is fine. Your note goes straight to your bookkeeper.
                    </p>
                  )}
                </div>
              )}

              {!already && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void saveOne(item.targetId)}
                    disabled={!readyIds.includes(item.targetId) || savingId === item.targetId || sending || isPreview}
                    title={isPreview ? 'Answers cannot be saved while previewing' : undefined}
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingId === item.targetId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save answer
                  </button>
                  {!readyIds.includes(item.targetId) && (
                    <span className="text-xs text-gray-500">Pick a category, a payee, or write a note to save.</span>
                  )}
                  {cardErrors[item.targetId] && (
                    <span role="alert" className="flex items-start gap-1 text-xs text-red-700">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {cardErrors[item.targetId]}
                    </span>
                  )}
                </div>
              )}

              <AttachControl
                companyId={activeCompanyId!}
                targetKind={item.targetKind}
                targetId={item.targetId}
                initialCount={item.myAttachmentCount}
              />
            </li>
          );
        })}
      </ul>

      {answered > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white p-3 shadow-lg">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <span className="text-sm text-gray-600">
              {answered} answer{answered === 1 ? '' : 's'} not saved yet
            </span>
            <button
              onClick={send}
              disabled={sending || savingId !== null || isPreview}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Save all {answered}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * "Send the receipt" for one row.
 *
 * Deliberately independent of the answer flow: a client often has the photo
 * but not the category, or remembers the receipt after already answering, so
 * this uploads immediately rather than waiting for "Send to my bookkeeper".
 *
 * The list is fetched lazily, only when the client opens it. The row already
 * arrives with a count, so the common case (nothing attached, or just a
 * number to show) costs no request at all.
 */
function AttachControl({
  companyId, targetKind, targetId, initialCount,
}: {
  companyId: string;
  targetKind: 'bank_feed_item' | 'transaction';
  targetId: string;
  initialCount: number;
}) {
  const [count, setCount] = useState(initialCount);
  const [files, setFiles] = useState<AttachedFile[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const base = import.meta.env.BASE_URL;
  const query = `companyId=${companyId}&targetKind=${targetKind}&targetId=${targetId}`;

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch(`${base}api/portal/categorize/attachments?${query}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      const list: AttachedFile[] = body.attachments ?? [];
      setFiles(list);
      setCount(list.length);
    } catch {
      setProblem('Could not load your files.');
    }
  }, [base, query]);

  const onPick = async (picked: FileList | null) => {
    if (!picked || picked.length === 0) return;
    const list = Array.from(picked);
    const tooBig = list.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
    if (tooBig) {
      // Caught here so the client is not made to wait for the upload to fail.
      setProblem(`"${tooBig.name}" is bigger than ${MAX_FILE_MB} MB.`);
      return;
    }

    setBusy(true); setProblem(null);
    try {
      const form = new FormData();
      form.append('companyId', companyId);
      form.append('targetKind', targetKind);
      form.append('targetId', targetId);
      for (const f of list) form.append('files', f);

      const res = await fetch(`${base}api/portal/categorize/attachments`, {
        method: 'POST', credentials: 'include', body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      const body = await res.json();
      const saved: AttachedFile[] = body.attachments ?? [];
      setCount((c) => c + saved.length);
      // Only merge into an already-open list; otherwise leave it unfetched.
      setFiles((prev) => (prev ? [...prev, ...saved] : null));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not send that file.');
    } finally {
      setBusy(false);
      // Without this, picking the SAME file twice fires no change event.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async (id: string) => {
    setBusy(true); setProblem(null);
    try {
      const res = await fetch(`${base}api/portal/categorize/attachments/${id}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setFiles((prev) => (prev ? prev.filter((f) => f.id !== id) : prev));
      setCount((c) => Math.max(0, c - 1));
    } catch {
      setProblem('Could not remove that file.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && files === null) void loadFiles();
  };

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => void onPick(e.target.files)}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? 'Sending…' : 'Attach a photo or receipt'}
        </button>

        {count > 0 && (
          <button
            type="button"
            onClick={toggle}
            className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
          >
            <Paperclip className="h-3.5 w-3.5" />
            {count} file{count === 1 ? '' : 's'} sent
          </button>
        )}
      </div>

      {problem && <p className="mt-2 text-xs text-red-600">{problem}</p>}

      {open && (
        <ul className="mt-2 space-y-1">
          {files === null && <li className="text-xs text-gray-500">Loading…</li>}
          {files?.length === 0 && <li className="text-xs text-gray-500">Nothing attached yet.</li>}
          {files?.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 rounded bg-gray-50 px-2 py-1.5">
              <span className="truncate text-xs text-gray-700">{f.fileName}</span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(f.id)}
                aria-label={`Remove ${f.fileName}`}
                className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-red-600 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
