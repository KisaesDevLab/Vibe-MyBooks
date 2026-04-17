// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import type { Account } from '@kis-books/shared';
import { Button } from '../../components/ui/Button';
import { useMergeAccounts } from '../../api/hooks/useAccounts';
import { X } from 'lucide-react';

interface MergeAccountsModalProps {
  accounts: Account[];
  onClose: () => void;
}

export function MergeAccountsModal({ accounts, onClose }: MergeAccountsModalProps) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const mergeAccounts = useMergeAccounts();

  const nonSystemAccounts = accounts.filter((a) => !a.isSystem && a.isActive);

  const handleMerge = () => {
    if (!sourceId || !targetId) return;
    mergeAccounts.mutate({ sourceId, targetId }, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Merge Accounts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            The source account will be deactivated and its transactions moved to the target.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source (will be removed)</label>
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">— Select source —</option>
              {nonSystemAccounts.filter((a) => a.id !== targetId).map((a) => (
                <option key={a.id} value={a.id}>{a.accountNumber ? `${a.accountNumber} — ` : ''}{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target (will keep)</label>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">— Select target —</option>
              {nonSystemAccounts.filter((a) => a.id !== sourceId).map((a) => (
                <option key={a.id} value={a.id}>{a.accountNumber ? `${a.accountNumber} — ` : ''}{a.name}</option>
              ))}
            </select>
          </div>

          {mergeAccounts.error && <p className="text-sm text-red-600">{mergeAccounts.error.message}</p>}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={handleMerge} disabled={!sourceId || !targetId} loading={mergeAccounts.isPending}>
            Merge
          </Button>
        </div>
      </div>
    </div>
  );
}
