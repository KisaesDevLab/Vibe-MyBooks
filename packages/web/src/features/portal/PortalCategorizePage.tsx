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

import { useCallback, useEffect, useState } from 'react';
import { Check, HelpCircle, Loader2, Send, User } from 'lucide-react';
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
}

interface Category { id: string; label: string; group: string; hint: string | null }

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

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
