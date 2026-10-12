// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// "Email staff when the client categorizes transactions" — the per-client
// notify list for the "<Client>: <Contact> categorized N transactions"
// email. Same picker as the doc-request rule's "Email staff when the client
// submits". Nobody checked = nobody is emailed; the answers still show as
// unread on the Client suggested tab.

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toaster';
import { useSaveSuggestionNotifySettings, useSuggestionNotifySettings } from '../../../api/hooks/useUncategorized';
import { StaffNotifyPicker, liveNotifyIds, useStaffUserOptions } from '../reminders/docRequestFormParts';

export const SUGGESTION_NOTIFY_LEGEND = 'Email staff when the client categorizes transactions';
const HELP =
  'Each checked person gets one email when the client (or a team member) suggests categories for this client’s '
  + 'transactions. Nobody checked = no email; the answers still show as unread on the Client suggested tab.';

export function SuggestionNotifyModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const settings = useSuggestionNotifySettings(open);
  const save = useSaveSuggestionNotifySettings();
  const staffUsers = useStaffUserOptions();
  const [selected, setSelected] = useState<string[] | null>(null);

  useEffect(() => {
    if (!open) { setSelected(null); return; }
    if (selected === null && settings.data) setSelected(settings.data.notifyUserIds);
  }, [open, settings.data, selected]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggle = (id: string) => setSelected((prev) => {
    const cur = prev ?? [];
    return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  });

  const onSave = () => {
    save.mutate(liveNotifyIds(staffUsers, selected ?? []), {
      onSuccess: (res) => {
        toast.success(res.notifyUserIds.length === 0
          ? 'Saved. Nobody will be emailed when this client categorizes transactions.'
          : `Saved. ${res.notifyUserIds.length} ${res.notifyUserIds.length === 1 ? 'person' : 'people'} will be emailed.`);
        onClose();
      },
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not save.'),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Email notifications for client suggestions"
    >
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">Email notifications</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 px-4 py-4">
          {settings.isError ? (
            <p className="text-sm text-red-700">Could not load the notification settings.</p>
          ) : selected === null ? (
            <p className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
          ) : (
            <StaffNotifyPicker
              staffUsers={staffUsers}
              selected={selected}
              onToggle={toggle}
              legend={SUGGESTION_NOTIFY_LEGEND}
              help={HELP}
            />
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} disabled={selected === null || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
