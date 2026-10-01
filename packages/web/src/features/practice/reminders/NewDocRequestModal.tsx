// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// One-off document request: asks one portal contact for one document and
// sends the request right away. No standing rule is created — the request
// lives in the Open requests grid like any other (reminders, unread on
// upload, cancel / mark received).

import { useMemo, useState } from 'react';
import { DOCUMENT_TYPES, type DocumentType } from '@kis-books/shared';
import { usePortalContacts } from '../../../api/hooks/usePortalContacts';
import { useFeatureFlag } from '../../../api/hooks/useFeatureFlag';
import { api } from './RemindersPage';
import {
  DOCUMENT_TYPE_LABELS,
  StaffNotifyPicker,
  StatementRoutingSelect,
  isStatementType,
  liveNotifyIds,
  routingPayload,
  useBankConnectionOptions,
  useStaffUserOptions,
} from './docRequestFormParts';

type SendResult = 'sent' | 'suppressed' | 'capped' | 'error' | 'not_found';

function isoLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** What to tell the user once the request exists. */
export function sendOutcomeMessage(result: SendResult, who: string): { ok: boolean; text: string } {
  switch (result) {
    case 'sent': return { ok: true, text: `Request sent to ${who}.` };
    case 'suppressed': return { ok: false, text: `Request created, but ${who} has opted out of these messages — it was not sent. It still shows in their portal.` };
    default: return { ok: false, text: `Request created, but the message to ${who} could not be sent. Use Remind now to try again.` };
  }
}

export function NewDocRequestModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (message: { ok: boolean; text: string }) => void;
}) {
  const { data: contactsData } = usePortalContacts({ status: 'active' });
  const smsEnabled = useFeatureFlag('DOC_REQUEST_SMS_V1');
  const stmtAutoImportEnabled = useFeatureFlag('STATEMENT_AUTO_IMPORT_V1');
  const bankConnections = useBankConnectionOptions(stmtAutoImportEnabled);
  const staffUsers = useStaffUserOptions();

  const [contactId, setContactId] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('other');
  const [description, setDescription] = useState('');
  const [periodLabel, setPeriodLabel] = useState(() => String(new Date().getFullYear()));
  const [dueDate, setDueDate] = useState(() => isoLocalDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));
  const [reminderChannel, setReminderChannel] = useState<'email' | 'sms' | 'both'>('email');
  const [routingChoice, setRoutingChoice] = useState('');
  const [notifyUserIds, setNotifyUserIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const contacts = contactsData?.contacts ?? [];
  const selected = useMemo(() => contacts.find((c) => c.id === contactId) ?? null, [contacts, contactId]);
  const toggleNotify = (id: string) =>
    setNotifyUserIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!contactId) { setErr('Pick a contact'); return; }
    setSubmitting(true);
    try {
      const r = await api<{ requestId: string; sendResult: SendResult }>('/practice/document-requests', {
        method: 'POST',
        body: JSON.stringify({
          contactId,
          documentType,
          description,
          periodLabel,
          dueDate: dueDate || null,
          reminderChannel: smsEnabled ? reminderChannel : 'email',
          notifyUserIds: liveNotifyIds(staffUsers, notifyUserIds),
          ...(stmtAutoImportEnabled && isStatementType(documentType) ? routingPayload(routingChoice) : {}),
        }),
      });
      const who = selected
        ? (`${selected.firstName ?? ''} ${selected.lastName ?? ''}`.trim() || selected.email)
        : 'the contact';
      onCreated(sendOutcomeMessage(r.sendResult, who));
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not send the request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-doc-request-title"
        className="bg-white rounded-lg shadow-xl w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 id="new-doc-request-title" className="text-base font-semibold text-gray-900">New document request</h2>
          <p className="text-sm text-gray-600 mt-0.5">
            A one-time request, sent now. It shows in their portal and is followed up on your reminder schedule until they upload it.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-sm">
            <span className="block text-gray-800 mb-1">Contact</span>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Select…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName || c.lastName
                    ? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() + ` — ${c.email}`
                    : c.email}
                </option>
              ))}
            </select>
            {contactsData && contacts.length === 0 && (
              <p className="text-xs text-amber-700 mt-1">No active portal contacts — invite one under Practice → Client Portal first.</p>
            )}
          </label>
          <label className="block text-sm">
            <span className="block text-gray-800 mb-1">What do you need?</span>
            <input
              type="text"
              required
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 2025 Form 1098 from Chase"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Printed in the message so the contact knows what to send.</p>
          </label>
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
              <span className="block text-gray-800 mb-1">For period</span>
              <input
                type="text"
                required
                maxLength={40}
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
                placeholder="e.g. 2025 or June 2026"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="block text-gray-800 mb-1">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">Leave blank for no due date.</p>
            </label>
            {smsEnabled && (
              <label className="block text-sm">
                <span className="block text-gray-800 mb-1">Send by</span>
                <select
                  value={reminderChannel}
                  onChange={(e) => setReminderChannel(e.target.value as 'email' | 'sms' | 'both')}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="email">Email</option>
                  <option value="sms">Text message (SMS)</option>
                  <option value="both">Email &amp; SMS</option>
                </select>
                {reminderChannel !== 'email' && selected && !selected.phone && (
                  <p className="text-xs text-amber-700 mt-1">No phone on file — this will go by email.</p>
                )}
              </label>
            )}
          </div>
          {stmtAutoImportEnabled && isStatementType(documentType) && (
            <StatementRoutingSelect value={routingChoice} onChange={setRoutingChoice} connections={bankConnections} subject="this request" />
          )}
          <StaffNotifyPicker staffUsers={staffUsers} selected={notifyUserIds} onToggle={toggleNotify} />
          {err && (
            <div role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">{err}</div>
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
              {submitting ? 'Sending…' : 'Send request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
