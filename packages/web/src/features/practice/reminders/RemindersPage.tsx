// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState } from 'react';
import { Bell, Send, Plus, Trash2, FileText, AlertTriangle, CalendarClock, Inbox, MessageSquare } from 'lucide-react';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { useFeatureFlag } from '../../../api/hooks/useFeatureFlag';
import { RecurringDocRequestsTab } from './RecurringDocRequestsTab';
import { DocumentRequestsTab } from './DocumentRequestsTab';

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 13 — bookkeeper UI for
// reminder schedules + dispatch trigger + open-rate widget.

interface Schedule {
  id: string;
  triggerType: string;
  cadenceDays: number[];
  channelStrategy: string;
  maxPerWeek: number;
  quietHoursStart: number;
  quietHoursEnd: number;
  active: boolean;
}

interface QueueItem {
  scheduleId: string;
  contactId: string;
  contactEmail: string;
  contactFirstName: string | null;
  triggerType: string;
  questionIds: string[];
}

interface ApiErrorBody {
  error?: { message?: string };
  message?: string;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
    },
  });
  if (!res.ok) {
    let detail: string | null = null;
    try {
      const body = (await res.json()) as ApiErrorBody;
      detail = body?.error?.message ?? body?.message ?? null;
    } catch {
      // fall through
    }
    throw new Error(detail ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function formatTrigger(t: string): string {
  return t.replace(/_/g, ' ');
}

interface StatsResponse {
  sent: number;
  opened: number;
  rate: number;
  smtpConfigured: boolean;
  smsSent: number;
  smsDelivered: number;
}

interface DispatchResponse {
  attempted: number;
  sent: number;
  suppressed: number;
  capped: number;
}

interface DocRequestDashboard {
  openRequests: number;
  overdue: number;
  avgFulfilDays: number | null;
}

type ActiveTab = 'schedules' | 'recurring' | 'open';

export function RemindersPage() {
  const [schedules, setSchedules] = useState<Schedule[] | null>(null);
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [docDash, setDocDash] = useState<DocRequestDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [tab, setTab] = useState<ActiveTab>('schedules');
  const docRequestsEnabled = useFeatureFlag('RECURRING_DOC_REQUESTS_V1');
  const smsEnabled = useFeatureFlag('DOC_REQUEST_SMS_V1');

  const reload = async () => {
    try {
      setError(null);
      const [s, q, st] = await Promise.all([
        api<{ schedules: Schedule[] }>('/practice/portal/reminders/schedules'),
        api<{ queue: QueueItem[] }>('/practice/portal/reminders/preview'),
        api<StatsResponse>('/practice/portal/reminders/stats'),
      ]);
      setSchedules(s.schedules);
      setQueue(q.queue);
      setStats(st);
      if (docRequestsEnabled) {
        try {
          const d = await api<DocRequestDashboard>('/practice/document-requests/dashboard');
          setDocDash(d);
        } catch {
          // Non-fatal — the doc-request dashboard tiles are extras,
          // not load-bearing for the schedules workflow.
          setDocDash(null);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reminders.');
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docRequestsEnabled]);

  const dispatch = async () => {
    setDispatching(true);
    setError(null);
    setInfo(null);
    try {
      const result = await api<DispatchResponse>('/practice/portal/reminders/dispatch', {
        method: 'POST',
      });
      setInfo(
        `Dispatched: ${result.sent} sent · ${result.suppressed} suppressed · ${result.capped} over weekly cap` +
          (result.attempted === 0 ? ' (no candidates due right now)' : ''),
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dispatch failed.');
    } finally {
      setDispatching(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this schedule?')) return;
    try {
      setError(null);
      await api(`/practice/portal/reminders/schedules/${id}`, { method: 'DELETE' });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.');
    }
  };

  const toggleActive = async (s: Schedule) => {
    setTogglingId(s.id);
    setError(null);
    try {
      await api(`/practice/portal/reminders/schedules/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !s.active }),
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toggle failed.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Reminders</h1>
          <p className="text-sm text-gray-600 mt-1">
            Automated nudges for unanswered portal questions, missing W-9s, and document requests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md"
          >
            <Plus className="h-4 w-4" /> New schedule
          </button>
          <button
            onClick={dispatch}
            disabled={dispatching}
            className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-md"
          >
            <Send className="h-4 w-4" />
            {dispatching ? 'Dispatching…' : 'Dispatch now'}
          </button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-3 p-3 border border-red-200 bg-red-50 rounded-md text-sm text-red-700"
        >
          {error}
        </div>
      )}
      {info && !error && (
        <div
          role="status"
          className="mb-3 p-3 border border-emerald-200 bg-emerald-50 rounded-md text-sm text-emerald-800"
        >
          {info}
        </div>
      )}
      {stats && !stats.smtpConfigured && (
        <div className="mb-3 p-3 border border-amber-200 bg-amber-50 rounded-md text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            SMTP is not configured. Reminders will be logged to the server console instead of
            being delivered. Configure SMTP under <strong>Settings → Email</strong> to send real
            emails.
          </span>
        </div>
      )}

      <div className={`grid ${docRequestsEnabled ? (smsEnabled ? 'grid-cols-3 md:grid-cols-7' : 'grid-cols-3 md:grid-cols-6') : 'grid-cols-3'} gap-3 mb-6`}>
        <Tile label="Sent · 30 days" value={stats ? String(stats.sent) : '—'} />
        <Tile label="Opened" value={stats ? String(stats.opened) : '—'} />
        <Tile
          label="Open rate"
          value={stats && stats.sent > 0 ? `${(stats.rate * 100).toFixed(1)}%` : '—'}
        />
        {smsEnabled && (
          <Tile
            label="SMS sent · 30 days"
            value={stats ? String(stats.smsSent) : '—'}
            icon={<MessageSquare className="h-3.5 w-3.5" />}
          />
        )}
        {docRequestsEnabled && (
          <>
            <Tile label="Open requests" value={docDash ? String(docDash.openRequests) : '—'} />
            <Tile label="Overdue" value={docDash ? String(docDash.overdue) : '—'} />
            <Tile
              label="Avg time-to-fulfil"
              value={docDash && docDash.avgFulfilDays !== null ? `${docDash.avgFulfilDays.toFixed(1)}d` : '—'}
            />
          </>
        )}
      </div>

      {docRequestsEnabled && (
        <div className="border-b border-gray-200 mb-4">
          <nav className="-mb-px flex gap-4" aria-label="Reminders tabs">
            <TabButton active={tab === 'schedules'} onClick={() => setTab('schedules')} icon={<Bell className="h-4 w-4" />}>
              Schedules
            </TabButton>
            <TabButton active={tab === 'recurring'} onClick={() => setTab('recurring')} icon={<CalendarClock className="h-4 w-4" />}>
              Recurring requests
            </TabButton>
            <TabButton active={tab === 'open'} onClick={() => setTab('open')} icon={<Inbox className="h-4 w-4" />}>
              Open requests {docDash && docDash.openRequests > 0 ? `(${docDash.openRequests})` : ''}
            </TabButton>
          </nav>
        </div>
      )}

      {tab === 'recurring' && docRequestsEnabled && <RecurringDocRequestsTab />}
      {tab === 'open' && docRequestsEnabled && <DocumentRequestsTab onChange={reload} />}

      {tab === 'schedules' && (<>
      <h2 className="text-base font-semibold text-gray-900 mb-2">Schedules</h2>
      {!schedules ? (
        <div className="py-6 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
          <Bell className="mx-auto h-10 w-10 text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">No reminder schedules yet.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Trigger</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Cadence (days)</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Channel</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Quiet hours</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Max / week</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Active</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {schedules.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900 capitalize">{formatTrigger(s.triggerType)}</td>
                  <td className="px-4 py-3 text-gray-700">{s.cadenceDays.join(', ')}</td>
                  <td className="px-4 py-3 text-gray-700">{s.channelStrategy.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 text-gray-700 tabular-nums">
                    {String(s.quietHoursStart).padStart(2, '0')}:00 –{' '}
                    {String(s.quietHoursEnd).padStart(2, '0')}:00
                  </td>
                  <td className="px-4 py-3 text-gray-700">{s.maxPerWeek}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleActive(s)}
                      disabled={togglingId === s.id}
                      aria-pressed={s.active}
                      aria-label={s.active ? 'Deactivate schedule' : 'Activate schedule'}
                      className={
                        'inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border ' +
                        (s.active
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          : 'border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100') +
                        ' disabled:opacity-50'
                      }
                    >
                      <span
                        className={
                          'h-1.5 w-1.5 rounded-full ' + (s.active ? 'bg-emerald-500' : 'bg-gray-400')
                        }
                      />
                      {s.active ? 'Active' : 'Paused'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(s.id)}
                      aria-label="Delete schedule"
                      className="p-1.5 rounded hover:bg-red-50 text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="text-base font-semibold text-gray-900 mb-2">Next dispatch preview</h2>
      {!queue ? null : queue.length === 0 ? (
        <p className="text-sm text-gray-500 border border-gray-200 rounded-md p-3 bg-gray-50">
          No reminders queued right now. They'll appear here as questions age past the cadence.
        </p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Contact</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Trigger</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700">Items</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {queue.map((q) => (
                <tr key={`${q.scheduleId}-${q.contactId}`}>
                  <td className="px-4 py-3 text-gray-900">{q.contactEmail}</td>
                  <td className="px-4 py-3 text-gray-700 capitalize">{formatTrigger(q.triggerType)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{q.questionIds.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <TemplatesSection />
      </div>
      </>)}

      {showAdd && <AddScheduleModal onClose={() => setShowAdd(false)} onCreated={reload} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={
        'inline-flex items-center gap-2 px-1 pb-2.5 border-b-2 text-sm font-medium ' +
        (active
          ? 'border-indigo-600 text-indigo-700'
          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300')
      }
    >
      {icon}
      {children}
    </button>
  );
}

function TemplatesSection() {
  interface ReminderTemplate {
    id: string;
    triggerType: string;
    channel: 'email' | 'sms';
    subject: string | null;
    body: string;
  }
  const [templates, setTemplates] = useState<ReminderTemplate[] | null>(null);
  const [editing, setEditing] = useState<{ triggerType: string; channel: 'email' | 'sms' } | null>(null);

  const reload = async () => {
    try {
      const data = await api<{ templates: ReminderTemplate[] }>('/practice/portal/reminders/templates');
      setTemplates(data.templates);
    } catch {
      setTemplates([]);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-base font-semibold text-gray-900">Templates</h2>
        <button
          onClick={() =>
            setEditing({ triggerType: 'unanswered_question', channel: 'email' })
          }
          className="inline-flex items-center gap-1 text-sm text-indigo-700 hover:underline"
        >
          <Plus className="h-4 w-4" /> Add / edit
        </button>
      </div>
      {!templates ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
          <FileText className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">No custom templates — defaults will be used.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Trigger</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Channel</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Subject</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 text-gray-900 capitalize">{formatTrigger(t.triggerType)}</td>
                  <td className="px-4 py-3 text-gray-700 capitalize">{t.channel}</td>
                  <td className="px-4 py-3 text-gray-700 truncate max-w-xs">{t.subject ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditing({ triggerType: t.triggerType, channel: t.channel })}
                      className="text-xs font-medium text-indigo-700 hover:underline"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <TemplateEditorModal
          initial={editing}
          existing={templates ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </section>
  );
}

function TemplateEditorModal({
  initial,
  existing,
  onClose,
  onSaved,
}: {
  initial: { triggerType: string; channel: 'email' | 'sms' };
  existing: { triggerType: string; channel: string; subject: string | null; body: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const found = existing.find(
    (e) => e.triggerType === initial.triggerType && e.channel === initial.channel,
  );
  const [trigger, setTrigger] = useState(initial.triggerType);
  const [channel, setChannel] = useState<'email' | 'sms'>(initial.channel);
  const [subject, setSubject] = useState(found?.subject ?? 'You have new questions waiting');
  const [body, setBody] = useState(
    found?.body ??
      'Hi {first_name},\n\nYour bookkeeper is waiting on {open_count} question(s).\n\n{portal_link}\n',
  );
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErr(null);
    try {
      await api('/practice/portal/reminders/templates', {
        method: 'PUT',
        body: JSON.stringify({ triggerType: trigger, channel, subject, body }),
      });
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Save failed.');
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
        className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900">Reminder template</h2>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="block text-gray-800 mb-1">Trigger</span>
              <select
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="unanswered_question">Unanswered question</option>
                <option value="w9_pending">W-9 pending</option>
                <option value="doc_request">Document request</option>
                <option value="recurring_non_transaction">Recurring task</option>
                <option value="magic_link_expiring">Magic-link expiring</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="block text-gray-800 mb-1">Channel</span>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as 'email' | 'sms')}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </label>
          </div>
          {channel === 'email' && (
            <label className="block text-sm">
              <span className="block text-gray-800 mb-1">Subject</span>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </label>
          )}
          <label className="block text-sm">
            <span className="block text-gray-800 mb-1">Body</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">
              Variables: {'{first_name}'}, {'{open_count}'}, {'{portal_link}'}, {'{firm_name}'}
            </p>
          </label>
          {err && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {err}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md"
            >
              {submitting ? 'Saving…' : 'Save template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddScheduleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [trigger, setTrigger] = useState('unanswered_question');
  const [cadence, setCadence] = useState('3,7,14');
  const [channel, setChannel] = useState('email_only');
  const [maxPerWeek, setMaxPerWeek] = useState(3);
  const [quietStart, setQuietStart] = useState(20);
  const [quietEnd, setQuietEnd] = useState(8);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const rawDays = cadence
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (rawDays.length === 0) {
      setError('Cadence must include at least one positive number.');
      setSubmitting(false);
      return;
    }
    // Sort ascending and dedupe so the dispatch step model behaves
    // intuitively (each step represents a strictly later nudge).
    const days = Array.from(new Set(rawDays)).sort((a, b) => a - b);
    if (days.some((d) => d > 365)) {
      setError('Cadence days must be 365 or less.');
      setSubmitting(false);
      return;
    }
    if (quietStart < 0 || quietStart > 23 || quietEnd < 0 || quietEnd > 23) {
      setError('Quiet hours must be 0–23.');
      setSubmitting(false);
      return;
    }
    try {
      await api('/practice/portal/reminders/schedules', {
        method: 'POST',
        body: JSON.stringify({
          triggerType: trigger,
          cadenceDays: days,
          channelStrategy: channel,
          maxPerWeek,
          quietHoursStart: quietStart,
          quietHoursEnd: quietEnd,
        }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed.');
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
        <h2 className="text-base font-semibold text-gray-900">New reminder schedule</h2>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm">
            <span className="block text-gray-800 mb-1">Trigger</span>
            <select
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="unanswered_question">Unanswered question</option>
              <option value="w9_pending">W-9 pending</option>
              <option value="doc_request">Document request</option>
              <option value="recurring_non_transaction">Recurring task</option>
              <option value="magic_link_expiring">Magic-link expiring</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="block text-gray-800 mb-1">Cadence (days, comma-separated)</span>
            <input
              type="text"
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="block text-gray-800 mb-1">Channel</span>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="email_only">Email only</option>
              <option value="sms_only">SMS only</option>
              <option value="both">Both</option>
              <option value="escalating">Escalating</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="block text-gray-800 mb-1">Max per week</span>
            <input
              type="number"
              min={1}
              max={20}
              value={maxPerWeek}
              onChange={(e) => setMaxPerWeek(parseInt(e.target.value, 10) || 1)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="block text-gray-800 mb-1">Quiet hours start (0–23)</span>
              <input
                type="number"
                min={0}
                max={23}
                value={quietStart}
                onChange={(e) => setQuietStart(parseInt(e.target.value, 10) || 0)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="block text-gray-800 mb-1">Quiet hours end (0–23)</span>
              <input
                type="number"
                min={0}
                max={23}
                value={quietEnd}
                onChange={(e) => setQuietEnd(parseInt(e.target.value, 10) || 0)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </label>
          </div>
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md"
            >
              {submitting ? 'Saving…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Tile({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="p-3 rounded-lg border border-gray-200 bg-white">
      <p className="text-xs text-gray-500 uppercase flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  );
}

export default RemindersPage;
