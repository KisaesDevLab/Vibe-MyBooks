// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState } from 'react';
import type { DocumentRequestSummary } from '@kis-books/shared';
import { useFeatureFlag } from '../../../api/hooks/useFeatureFlag';
import { api } from './RemindersPage';

// RECURRING_DOC_REQUESTS_V1 — per-portal-contact rollup. Drops into
// the EditContactModal in ClientPortalAdminPage so a CPA can see
// "what's outstanding for this client?" without leaving the modal.

export function PortalContactDocumentsPanel({ contactId }: { contactId: string }) {
  const enabled = useFeatureFlag('RECURRING_DOC_REQUESTS_V1');
  const [items, setItems] = useState<DocumentRequestSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    api<{ items: DocumentRequestSummary[] }>(`/practice/contacts/${contactId}/document-requests`)
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load documents.'));
  }, [contactId, enabled]);

  if (!enabled) return null;

  return (
    <section className="border-t border-gray-200 pt-4 mt-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">Document requests</h3>
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-2">
          {error}
        </div>
      )}
      {!items ? (
        <p className="text-xs text-gray-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-gray-500">No standing requests for this contact.</p>
      ) : (
        <ul className="text-sm text-gray-800 space-y-1">
          {items.slice(0, 8).map((r) => {
            const overdue = r.status === 'pending' && r.dueDate && new Date(r.dueDate) < new Date();
            return (
              <li key={r.id} className="flex items-center justify-between border border-gray-200 rounded-md px-3 py-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{r.description}</div>
                  <div className="text-xs text-gray-500">
                    {r.periodLabel} · {r.status}
                    {r.dueDate && ` · due ${new Date(r.dueDate).toLocaleDateString()}`}
                  </div>
                </div>
                {overdue && (
                  <span className="text-xs font-medium text-red-700 ml-2">Overdue</span>
                )}
                {r.status === 'submitted' && (
                  <span className="text-xs font-medium text-emerald-700 ml-2">Submitted</span>
                )}
              </li>
            );
          })}
          {items.length > 8 && (
            <li className="text-xs text-gray-500">…and {items.length - 8} more — see Reminders → Open requests.</li>
          )}
        </ul>
      )}
    </section>
  );
}
