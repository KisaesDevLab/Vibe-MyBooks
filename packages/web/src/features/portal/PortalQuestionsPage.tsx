// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, MessageSquare, Send, Plus } from 'lucide-react';
import { usePortal } from './PortalLayout';

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 10.5/10.6 — portal-side
// question list + detail/respond.

interface QuestionListItem {
  id: string;
  body: string;
  status: string;
  transactionId: string | null;
  askedAt?: string;
  respondedAt?: string | null;
  resolvedAt?: string | null;
}

interface QuestionDetail {
  id: string;
  body: string;
  status: string;
  transactionId: string | null;
  askedAt: string;
  messages: Array<{
    id: string;
    senderType: 'bookkeeper' | 'contact' | 'system';
    body: string;
    createdAt: string;
  }>;
  transactionContext: { amount: string; memo: string | null; date: string | null } | null;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function PortalQuestionsListPage() {
  const { me, activeCompanyId } = usePortal();
  const isPreview = !!me.preview;
  const canAsk =
    !!me.contact.companies.find((c) => c.companyId === activeCompanyId)?.questionsForUsAccess;

  const [data, setData] = useState<{ open: QuestionListItem[]; answered: QuestionListItem[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAsk, setShowAsk] = useState(false);

  const reload = () => {
    if (!activeCompanyId) return;
    setLoading(true);
    fetchJson<{ open: QuestionListItem[]; answered: QuestionListItem[] }>(
      `/api/portal/questions?companyId=${activeCompanyId}`,
    )
      .then((d) => setData(d))
      .catch(() => setError('Could not load your questions.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId]);

  if (loading) return <PortalLoading />;
  if (error) return <PortalErrorBox message={error} />;
  if (!data) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Questions</h1>
          <p className="text-sm text-gray-600 mt-1">
            Your bookkeeper sends you a question when they need clarification.
          </p>
        </div>
        {canAsk && (
          <button
            onClick={() => setShowAsk(true)}
            disabled={isPreview}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-3 py-2 rounded-md whitespace-nowrap"
            title={isPreview ? 'Disabled in preview mode' : 'Send a question to your bookkeeper'}
          >
            <Plus className="h-4 w-4" /> Ask
          </button>
        )}
      </div>

      <Section title="Open" empty="You're all caught up — no open questions right now.">
        {data.open.map((q) => (
          <QuestionRow key={q.id} q={q} />
        ))}
      </Section>

      <Section title="Answered" empty="No history yet.">
        {data.answered.map((q) => (
          <QuestionRow key={q.id} q={q} />
        ))}
      </Section>

      {showAsk && activeCompanyId && (
        <AskQuestionModal
          companyId={activeCompanyId}
          onClose={() => setShowAsk(false)}
          onSent={() => {
            setShowAsk(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function AskQuestionModal({
  companyId,
  onClose,
  onSent,
}: {
  companyId: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    setErr(null);
    try {
      const res = await fetch('/api/portal/questions/ask', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, body: body.trim() }),
      });
      if (res.status === 403) {
        setErr('Action disabled in preview mode.');
        return;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `HTTP ${res.status}`);
      }
      onSent();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not send your question.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-base font-semibold text-gray-900">Ask your bookkeeper</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            They'll see this in their inbox and reply when they can.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            autoFocus
            placeholder="What would you like to ask?"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {err && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {err}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!body.trim() || submitting}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuestionRow({ q }: { q: QuestionListItem }) {
  return (
    <Link
      to={`/portal/questions/${q.id}`}
      className="block bg-white border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-900 line-clamp-2">{q.body}</p>
          <div className="mt-1 text-xs text-gray-500 flex items-center gap-2">
            <StatusBadge status={q.status} />
            {q.askedAt && <span>asked {new Date(q.askedAt).toLocaleDateString()}</span>}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />
      </div>
    </Link>
  );
}

export function PortalQuestionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reload = () =>
    fetchJson<{ question: QuestionDetail }>(`/api/portal/questions/${id}`)
      .then((d) => setQ(d.question))
      .catch(() => setError('Could not load this question.'))
      .finally(() => setLoading(false));

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSubmitting(true);
    try {
      await fetchJson(`/api/portal/questions/${id}/answers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply.trim() }),
      });
      setReply('');
      await reload();
    } catch {
      setError('Could not send your answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PortalLoading />;
  if (error || !q) return <PortalErrorBox message={error ?? 'Question not found.'} />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-500 hover:text-gray-800 mb-4"
      >
        ← Back
      </button>

      <article className="bg-white border border-gray-200 rounded-lg p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-indigo-50">
            <MessageSquare className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-gray-500">
              <StatusBadge status={q.status} />{' '}
              <span className="ml-2">asked {new Date(q.askedAt).toLocaleString()}</span>
            </p>
            <p className="mt-2 text-gray-900 whitespace-pre-wrap">{q.body}</p>
            {q.transactionContext && (
              <div className="mt-3 inline-flex items-center gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded px-2 py-1">
                <span>Tx</span>
                <span className="font-medium text-gray-900">${q.transactionContext.amount}</span>
                {q.transactionContext.date && (
                  <span>· {new Date(q.transactionContext.date).toLocaleDateString()}</span>
                )}
                {q.transactionContext.memo && <span>· {q.transactionContext.memo}</span>}
              </div>
            )}
          </div>
        </div>
      </article>

      <section className="mt-4 space-y-3">
        {q.messages.map((m) => (
          <div
            key={m.id}
            className={`bg-white border rounded-lg p-3 ${
              m.senderType === 'contact' ? 'border-indigo-200 ml-6' : 'border-gray-200 mr-6'
            }`}
          >
            <p className="text-xs text-gray-500">
              {m.senderType === 'contact' ? 'You' : m.senderType === 'system' ? 'System' : 'Your bookkeeper'}{' '}
              · {new Date(m.createdAt).toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{m.body}</p>
          </div>
        ))}
      </section>

      {q.status !== 'resolved' && (
        <form onSubmit={submit} className="mt-5 bg-white border border-gray-200 rounded-lg p-4">
          <label htmlFor="portal-reply" className="block text-sm font-medium text-gray-800 mb-1">
            Your reply
          </label>
          <textarea
            id="portal-reply"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Share what you know — short and specific is best."
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={!reply.trim() || submitting}
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    viewed: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    responded: 'bg-blue-50 text-blue-800 ring-blue-600/20',
    resolved: 'bg-green-50 text-green-800 ring-green-600/20',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset ${
        styles[status] ?? styles['open']
      }`}
    >
      {status}
    </span>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const arr = Array.isArray(children) ? children : [children];
  return (
    <section className="mt-6">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{title}</h2>
      {arr.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white border border-gray-200 rounded-lg p-4">{empty}</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}

function PortalLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 text-sm text-gray-500">Loading…</div>
  );
}

function PortalErrorBox({ message }: { message: string }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm text-red-700">
        {message}
      </div>
    </div>
  );
}

export default PortalQuestionsListPage;
