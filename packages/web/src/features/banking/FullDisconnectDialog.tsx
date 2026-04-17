// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useRemovePlaidItem } from '../../api/hooks/usePlaid';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface Props {
  itemId: string;
  institutionName: string;
  accounts: any[];
  hiddenAccountCount: number;
  onClose: () => void;
  onRemoved: () => void;
}

export function FullDisconnectDialog({ itemId, institutionName, accounts, hiddenAccountCount, onClose, onRemoved }: Props) {
  const [confirmName, setConfirmName] = useState('');
  const [deletePending, setDeletePending] = useState(true);
  const removeItem = useRemovePlaidItem();

  const mappedAccounts = accounts.filter((a: any) => a.mapping);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="h-5 w-5 text-red-500" />
          <h3 className="text-lg font-semibold text-gray-900">Delete Connection: {institutionName}</h3>
        </div>

        <div className="space-y-4 text-sm">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            <p className="font-semibold mb-1">This will permanently disconnect {institutionName} from ALL companies.</p>
            <ul className="list-disc list-inside text-xs space-y-0.5 mt-2">
              <li>Plaid access will be revoked — no new transactions will be imported</li>
              <li>All account mappings across all companies will be removed</li>
              {hiddenAccountCount > 0 && <li className="font-medium">{hiddenAccountCount} account{hiddenAccountCount > 1 ? 's' : ''} in other companies will also be disconnected</li>}
            </ul>
          </div>

          {/* Affected accounts */}
          {mappedAccounts.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Your mapped accounts</p>
              {mappedAccounts.map((a: any) => (
                <div key={a.id} className="text-sm text-gray-700 py-0.5">
                  {a.name} {a.mask && `(****${a.mask})`}
                </div>
              ))}
            </div>
          )}

          {hiddenAccountCount > 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              {hiddenAccountCount} account{hiddenAccountCount > 1 ? 's' : ''} assigned to other companies will also lose their connection.
            </p>
          )}

          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-xs">
            <p className="font-medium">What will NOT be affected:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Transactions already categorized remain in your books</li>
              <li>Chart of Accounts entries are not deleted</li>
              <li>Reconciliation history is preserved</li>
            </ul>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={deletePending} onChange={(e) => setDeletePending(e.target.checked)}
              className="rounded border-gray-300 text-red-600" />
            <span className="text-gray-700">Delete pending (uncategorized) bank feed items from all affected companies</span>
          </label>

          <div>
            <p className="text-gray-600 mb-2">Type <strong>{institutionName}</strong> to confirm:</p>
            <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={institutionName} />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger"
            onClick={async () => { await removeItem.mutateAsync({ itemId, deleteFeedItems: deletePending }); onRemoved(); }}
            loading={removeItem.isPending}
            disabled={confirmName !== institutionName}>
            Delete Connection
          </Button>
        </div>
      </div>
    </div>
  );
}
