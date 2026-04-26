// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, CalendarClock, PhoneOff } from 'lucide-react';
import {
  DOCUMENT_TYPES,
  RECURRING_FREQUENCIES,
  type CadenceKind,
  type DocumentType,
  type RecurringDocRequestSummary,
  type RecurringFrequency,
} from '@kis-books/shared';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { usePortalContacts } from '../../../api/hooks/usePortalContacts';
import { useFeatureFlag } from '../../../api/hooks/useFeatureFlag';
import { api } from './RemindersPage';

// RECURRING_DOC_REQUESTS_V1 — standing-rule list + create/edit form.

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annually: 'Annually',
};

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  bank_statement: 'Bank statement',
  cc_statement: 'Credit-card statement',
  payroll_report: 'Payroll report',
  receipt_batch: 'Receipt batch',
  other: 'Other',
};

export function RecurringDocRequestsTab() {
  const [rules, setRules] = useState<RecurringDocRequestSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<RecurringDocRequestSummary | null>(null);
  const smsEnabled = useFeatureFlag('DOC_REQUEST_SMS_V1');
  const { data: contactsData } = usePortalContacts({ status: 'active' });
  const contactPhoneMap = useMemo<Map<string, string | null>>(() => {
    const m = new Map<string, string | null>();
    for (const c of contactsData?.contacts ?? []) m.set(c.id, c.phone);
    return m;
  }, [contactsData]);

  const reload = async () => {
    try {
      setError(null);
      const r = await api<{ rules: RecurringDocRequestSummary[] }>('/practice/recurring-doc-requests');
      setRules(r.rules);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rules.');
    }
  };

  useEffect(() => { void reload(); }, []);

  const remove = async (rule: RecurringDocRequestSummary) => {
    if (!confirm(`Cancel rule for ${rule.contactEmail} (${DOCUMENT_TYPE_LABELS[rule.documentType]})? Already-issued requests are preserved.`)) return;
    try {
      await api(`/practice/recurring-doc-requests/${rule.id}`, { method: 'DELETE' });
      void reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed.');
    }
  };

  const toggle = async (rule: RecurringDocRequestSummary) => {
    try {
      await api(`/practice/recurring-doc-requests/${rule.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !rule.active }),
      });
      void reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toggle failed.');
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Standing document requests</h2>
          <p className="text-sm text-gray-600 mt-0.5">
            Each rule issues one document_request per cycle and emails the assigned contact.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md"
        >
          <Plus className="h-4 w-4" /> New rule
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-3 p-3 border border-red-200 bg-red-50 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {!rules ? (
        <div className="py-6 flex justify-center"><LoadingSpinner /></div>
      ) : rules.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
          <CalendarClock className="mx-auto h-10 w-10 text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">No standing requests yet. Click "New rule" to create one.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Contact</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Document</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Cadence</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Next issuance</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Last issued</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700"># open</th>
                <th className="px-4 py-2 font-medium text-gray-700">Active</th>
                <th className="text-right px-4 py-2 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">
                    <div className="font-medium flex items-center gap-1.5">
                      {r.contactName ?? r.contactEmail}
                      {smsEnabled && contactPhoneMap.has(r.contactId) && !contactPhoneMap.get(r.contactId) && (
                        <span
                          title="No phone on file — SMS reminders won't reach this contact"
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium border border-amber-200 bg-amber-50 text-amber-800"
                        >
                          <PhoneOff className="h-3 w-3" />
                          no phone
                        </span>
                      )}
                    </div>
                    {r.contactName && <div className="text-xs text-gray-500">{r.contactEmail}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <div>{DOCUMENT_TYPE_LABELS[r.documentType]}</div>
                    <div className="text-xs text-gray-500 truncate max-w-xs">{r.description}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {FREQUENCY_LABELS[r.frequency]}
                    {r.dayOfMonth ? ` · day ${r.dayOfMonth}` : ''}
                    {r.cadenceDays.length > 0 && (
                      <div className="text-xs text-gray-500">Nudges: {r.cadenceDays.join(', ')} d</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700 tabular-nums">{formatDate(r.nextIssueAt)}</td>
                  <td className="px-4 py-3 text-gray-700 tabular-nums">
                    {r.lastIssuedAt ? formatDate(r.lastIssuedAt) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 tabular-nums">{r.outstandingCount}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => void toggle(r)}
                      aria-pressed={r.active}
                      className={
                        'inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border ' +
                        (r.active
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          : 'border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100')
                      }
                    >
                      <span className={'h-1.5 w-1.5 rounded-full ' + (r.active ? 'bg-emerald-500' : 'bg-gray-400')} />
                      {r.active ? 'Active' : 'Paused'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() => setEditing(r)}
                      className="text-xs font-medium text-indigo-700 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => void remove(r)}
                      aria-label="Cancel rule"
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

      {showAdd && (
        <RuleEditorModal
          mode="create"
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); void reload(); }}
        />
      )}
      {editing && (
        <RuleEditorModal
          mode="edit"
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void reload(); }}
        />
      )}
    </section>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString();
}

interface RuleEditorModalProps {
  mode: 'create' | 'edit';
  initial?: RecurringDocRequestSummary;
  onClose: () => void;
  onSaved: () => void;
}

const CRON_PRESETS: Array<{ id: string; label: string; expression: string; tz?: string }> = [
  { id: 'weekly-friday', label: 'Every Friday at 9 a.m.', expression: '0 9 * * 5' },
  { id: 'weekday-9am', label: 'Every weekday at 9 a.m.', expression: '0 9 * * 1-5' },
  { id: 'first-monday', label: 'First Monday of each month', expression: '0 9 * * 1#1' },
  { id: 'last-business-day', label: 'Last business day of month', expression: '@last-business-day-of-month' },
];

interface BankConnectionOption {
  id: string;
  institutionName: string | null;
  mask: string | null;
  companyId: string | null;
}

function RuleEditorModal({ mode, initial, onClose, onSaved }: RuleEditorModalProps) {
  const { data: contactsData } = usePortalContacts({ status: 'active' });
  const cronEnabled = useFeatureFlag('RECURRING_CRON_V1');
  const stmtAutoImportEnabled = useFeatureFlag('STATEMENT_AUTO_IMPORT_V1');
  const [bankConnections, setBankConnections] = useState<BankConnectionOption[]>([]);
  const [bankConnectionId, setBankConnectionId] = useState<string | null>(initial?.bankConnectionId ?? null);

  useEffect(() => {
    if (!stmtAutoImportEnabled) return;
    void api<{ connections: BankConnectionOption[] }>('/practice/bank-connections')
      .then((r) => setBankConnections(r.connections))
      .catch(() => setBankConnections([]));
  }, [stmtAutoImportEnabled]);
  const [contactId, setContactId] = useState(initial?.contactId ?? '');
  const [documentType, setDocumentType] = useState<DocumentType>(initial?.documentType ?? 'bank_statement');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [cadenceKind, setCadenceKind] = useState<CadenceKind>(initial?.cadenceKind ?? 'frequency');
  const [frequency, setFrequency] = useState<RecurringFrequency>(initial?.frequency ?? 'monthly');
  const [intervalValue, setIntervalValue] = useState(initial?.intervalValue ?? 1);
  const [dayOfMonth, setDayOfMonth] = useState(initial?.dayOfMonth ?? 3);
  const [cronExpression, setCronExpression] = useState(initial?.cronExpression ?? '0 9 * * 5');
  const [cronTimezone, setCronTimezone] = useState(initial?.cronTimezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [cronPresetId, setCronPresetId] = useState<string>(() => {
    const match = CRON_PRESETS.find((p) => p.expression === (initial?.cronExpression ?? ''));
    return match?.id ?? 'custom';
  });
  const [cronPreview, setCronPreview] = useState<string[] | null>(null);
  const [dueDays, setDueDays] = useState(initial?.dueDaysAfterIssue ?? 7);
  const [cadencePreset, setCadencePreset] = useState<'none' | 'standard' | 'firm'>(() => {
    if (!initial || initial.cadenceDays.length === 0) return 'none';
    if (JSON.stringify(initial.cadenceDays) === JSON.stringify([3, 7, 14])) return 'standard';
    return 'firm';
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Live preview for cron mode — debounced through useEffect.
  useEffect(() => {
    if (cadenceKind !== 'cron' || !cronExpression) {
      setCronPreview(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await api<{ next: string[] }>('/practice/recurring-doc-requests/preview', {
          method: 'POST',
          body: JSON.stringify({
            cadenceKind: 'cron',
            cronExpression,
            cronTimezone,
            count: 5,
          }),
        });
        setCronPreview(r.next);
      } catch {
        setCronPreview(null);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [cadenceKind, cronExpression, cronTimezone]);

  const cadenceDays =
    cadencePreset === 'none' ? [] :
    cadencePreset === 'standard' ? [3, 7, 14] :
    [7, 14, 30];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const payload = {
        documentType,
        description,
        cadenceKind,
        frequency,
        intervalValue,
        dayOfMonth: cadenceKind === 'cron' ? null : (frequency === 'annually' ? null : dayOfMonth),
        cronExpression: cadenceKind === 'cron' ? cronExpression : null,
        cronTimezone: cadenceKind === 'cron' ? cronTimezone : null,
        dueDaysAfterIssue: dueDays,
        cadenceDays,
        // Only meaningful for bank/cc statement document types; for
        // other types the API ignores it.
        bankConnectionId: stmtAutoImportEnabled && (documentType === 'bank_statement' || documentType === 'cc_statement')
          ? (bankConnectionId || null)
          : null,
      };
      if (mode === 'create') {
        if (!contactId) {
          setErr('Pick a contact');
          setSubmitting(false);
          return;
        }
        await api('/practice/recurring-doc-requests', {
          method: 'POST',
          body: JSON.stringify({ ...payload, contactId, active: true }),
        });
      } else if (initial) {
        await api(`/practice/recurring-doc-requests/${initial.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      onSaved();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Save failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-gray-900">
          {mode === 'create' ? 'New standing document request' : 'Edit rule'}
        </h2>
        <form onSubmit={submit} className="space-y-3">
          {mode === 'create' && (
            <label className="block text-sm">
              <span className="block text-gray-800 mb-1">Contact</span>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                {(contactsData?.contacts ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName || c.lastName
                      ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() + ` — ${c.email}`
                      : c.email}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="block text-gray-800 mb-1">Document type</span>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="block text-gray-800 mb-1">Frequency</span>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                {RECURRING_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-sm">
            <span className="block text-gray-800 mb-1">Description</span>
            <input
              type="text"
              required
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Wells Fargo checking xxxx-1234"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Printed in the email so the contact knows what to send.</p>
          </label>
          {stmtAutoImportEnabled && (documentType === 'bank_statement' || documentType === 'cc_statement') && (
            <label className="block text-sm">
              <span className="block text-gray-800 mb-1">Auto-import into bank connection</span>
              <select
                value={bankConnectionId ?? ''}
                onChange={(e) => setBankConnectionId(e.target.value || null)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="">Don't auto-import (route to receipts inbox for manual pick)</option>
                {bankConnections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.institutionName ?? 'Bank connection'}
                    {c.mask ? ` ····${c.mask}` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                When set, uploads against this rule are parsed and imported as bank-feed items
                directly. Leave blank if the firm prefers to review each statement first.
              </p>
            </label>
          )}
          {cronEnabled && (
            <fieldset className="block text-sm">
              <legend className="block text-gray-800 mb-1">Schedule mode</legend>
              <div className="flex gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="cadence-kind"
                    value="frequency"
                    checked={cadenceKind === 'frequency'}
                    onChange={() => setCadenceKind('frequency')}
                  />
                  <span>Simple (monthly / quarterly / annually)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="cadence-kind"
                    value="cron"
                    checked={cadenceKind === 'cron'}
                    onChange={() => setCadenceKind('cron')}
                  />
                  <span>Custom (cron / preset)</span>
                </label>
              </div>
            </fieldset>
          )}
          {cadenceKind === 'frequency' && (
            <div className="grid grid-cols-3 gap-3">
              <label className="block text-sm">
                <span className="block text-gray-800 mb-1">Every</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={intervalValue}
                  onChange={(e) => setIntervalValue(parseInt(e.target.value, 10) || 1)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </label>
              {frequency !== 'annually' && (
                <label className="block text-sm">
                  <span className="block text-gray-800 mb-1">Day of month</span>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(parseInt(e.target.value, 10) || 1)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">1–28 to avoid short-month surprises.</p>
                </label>
              )}
              <label className="block text-sm">
                <span className="block text-gray-800 mb-1">Due (days after)</span>
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={dueDays}
                  onChange={(e) => setDueDays(parseInt(e.target.value, 10) || 0)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </label>
            </div>
          )}
          {cadenceKind === 'cron' && (
            <div className="space-y-3">
              <label className="block text-sm">
                <span className="block text-gray-800 mb-1">Preset</span>
                <select
                  value={cronPresetId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setCronPresetId(id);
                    if (id === 'custom') return;
                    const p = CRON_PRESETS.find((x) => x.id === id);
                    if (p) setCronExpression(p.expression);
                  }}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  {CRON_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                  <option value="custom">Custom expression…</option>
                </select>
              </label>
              {cronPresetId === 'custom' && (
                <label className="block text-sm">
                  <span className="block text-gray-800 mb-1">Cron expression</span>
                  <input
                    type="text"
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    placeholder="0 9 * * 5"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    5-field cron: minute hour day-of-month month day-of-week. Use{' '}
                    <code className="font-mono">@last-business-day-of-month</code> for the named preset.
                  </p>
                </label>
              )}
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="block text-gray-800 mb-1">Timezone</span>
                  <input
                    type="text"
                    value={cronTimezone ?? ''}
                    onChange={(e) => setCronTimezone(e.target.value)}
                    placeholder="America/New_York"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm">
                  <span className="block text-gray-800 mb-1">Due (days after)</span>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={dueDays}
                    onChange={(e) => setDueDays(parseInt(e.target.value, 10) || 0)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </label>
              </div>
              {cronPreview && cronPreview.length > 0 && (
                <div className="text-xs text-gray-700 border border-gray-200 rounded-md p-2 bg-gray-50">
                  <p className="font-medium mb-1">Next 5 firings:</p>
                  <ul className="space-y-0.5 font-mono">
                    {cronPreview.map((iso) => (
                      <li key={iso}>{new Date(iso).toLocaleString()}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <fieldset className="block text-sm">
            <legend className="block text-gray-800 mb-1">Reminder cadence after issuance</legend>
            <div className="space-y-1">
              {(['none', 'standard', 'firm'] as const).map((p) => (
                <label key={p} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="cadence-preset"
                    value={p}
                    checked={cadencePreset === p}
                    onChange={() => setCadencePreset(p)}
                  />
                  <span>
                    {p === 'none' && 'No nudges (only the issuance email)'}
                    {p === 'standard' && 'Standard: 3, 7, 14 days'}
                    {p === 'firm' && 'Firm: 7, 14, 30 days'}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {err && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</div>
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
              {submitting ? 'Saving…' : mode === 'create' ? 'Create rule' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
