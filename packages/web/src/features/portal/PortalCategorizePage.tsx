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
import { Check, HelpCircle, Loader2, Paperclip, Send, Trash2, Upload, User } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { usePortal } from './PortalLayout';

interface QueueItem {
  targetKind: 'bank_feed_item' | 'transaction';
  targetId: string;
  date: string;
  description: string;
  amount: string;
  direction: 'money_out' | 'money_in';
  existingSuggestion: {
    id: string; status: string; label: string | null;
    note: string | null; rejectionReason: string | null;
  } | null;
  /** Files this client has already sent for the row. */
  myAttachmentCount: number;
}

interface AttachedFile {
  id: string; fileName: string; mimeType: string | null;
  fileSize: number | null; uploadedAt: string;
}

interface Category { id: string; label: string; group: string; hint: string | null }

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

export function PortalCategorizePage() {
  const { activeCompanyId } = usePortal();
  const [items, setItems] = useState<QueueItem[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  const base = import.meta.env.BASE_URL;

  const load = useCallback(async () => {
    if (!activeCompanyId) return;
    setItems(null); setError(null); setRetryable(false);
    try {
      const [qRes, cRes] = await Promise.all([
        fetch(`${base}api/portal/categorize/queue?companyId=${activeCompanyId}`, { credentials: 'include' }),
        fetch(`${base}api/portal/categorize/categories?companyId=${activeCompanyId}`, { credentials: 'include' }),
      ]);
      // 403 and flag-off are access states, not transient failures, so they
      // get no Retry button — the same posture as the banking page.
      if (qRes.status === 403 || cRes.status === 403) {
        setError('Categorizing is not enabled for your account.');
        return;
      }
      if (!qRes.ok || !cRes.ok) throw new Error(`HTTP ${qRes.status}/${cRes.status}`);
      const q = await qRes.json();
      const c = await cRes.json();
      if (q.featureEnabled === false || c.featureEnabled === false) {
        setError('Categorizing is not enabled for your account.');
        return;
      }
      setItems(q.items ?? []);
      setCategories(c.categories ?? []);
    } catch {
      setError('Could not load your transactions.');
      setRetryable(true);
    }
  }, [activeCompanyId, base]);

  useEffect(() => { void load(); }, [load, attempt]);

  const answered = Object.keys(picks).length;

  const send = async () => {
    if (answered === 0 || !activeCompanyId) return;
    setSending(true);
    try {
      const payload = Object.entries(picks).map(([targetId, categoryId]) => {
        const item = (items ?? []).find((i) => i.targetId === targetId)!;
        return {
          targetKind: item.targetKind,
          targetId,
          categoryId,
          note: notes[targetId]?.trim() || undefined,
        };
      });
      const res = await fetch(`${base}api/portal/categorize/suggestions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: activeCompanyId, items: payload }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      setSentCount(body.accepted?.length ?? 0);
      setPicks({}); setNotes({});
      setAttempt((a) => a + 1);
    } catch {
      setError('Could not send your answers. Nothing was lost — try again.');
      setRetryable(true);
    } finally {
      setSending(false);
    }
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 pb-28">
      <header className="mb-4 space-y-1">
        <h1 className="text-xl font-semibold text-gray-900">What was this?</h1>
        <p className="text-sm text-gray-600">
          Your bookkeeper could not tell what these were for. Pick the closest match and they
          will take it from there. Nothing you choose here changes your books on its own.
        </p>
      </header>

      {sentCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <Check className="h-4 w-4" />
          Sent {sentCount} answer{sentCount === 1 ? '' : 's'} to your bookkeeper.
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
                <div>
                  <div className="text-sm font-medium text-gray-900">{item.description}</div>
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
                  You said <strong>{already.label}</strong>.{' '}
                  {already.status === 'pending' && 'Waiting for your bookkeeper.'}
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
                    <option value="">Choose…</option>
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

                  {(pick === NOT_SURE || pick === PERSONAL || pick) && (
                    <input
                      type="text"
                      value={notes[item.targetId] ?? ''}
                      onChange={(e) => setNotes((n) => ({ ...n, [item.targetId]: e.target.value }))}
                      placeholder={pick === NOT_SURE
                        ? 'Tell your bookkeeper what you do know (required)'
                        : 'Add a note (optional)'}
                      maxLength={2000}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  )}

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
              {answered} answer{answered === 1 ? '' : 's'} ready
            </span>
            <button
              onClick={send}
              disabled={sending}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send to my bookkeeper
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
