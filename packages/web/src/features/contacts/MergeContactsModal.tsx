import { useState } from 'react';
import type { Contact } from '@kis-books/shared';
import { Button } from '../../components/ui/Button';
import { useMergeContacts } from '../../api/hooks/useContacts';
import { X } from 'lucide-react';

interface MergeContactsModalProps {
  contacts: Contact[];
  onClose: () => void;
}

export function MergeContactsModal({ contacts, onClose }: MergeContactsModalProps) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const mergeContacts = useMergeContacts();

  const activeContacts = contacts.filter((c) => c.isActive);

  const handleMerge = () => {
    if (!sourceId || !targetId) return;
    mergeContacts.mutate({ sourceId, targetId }, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Merge Contacts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            The source contact will be deactivated and its transactions moved to the target.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source (will be removed)</label>
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">— Select source —</option>
              {activeContacts.filter((c) => c.id !== targetId).map((c) => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target (will keep)</label>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">— Select target —</option>
              {activeContacts.filter((c) => c.id !== sourceId).map((c) => (
                <option key={c.id} value={c.id}>{c.displayName}</option>
              ))}
            </select>
          </div>

          {mergeContacts.error && <p className="text-sm text-red-600">{mergeContacts.error.message}</p>}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={handleMerge} disabled={!sourceId || !targetId} loading={mergeContacts.isPending}>
            Merge
          </Button>
        </div>
      </div>
    </div>
  );
}
