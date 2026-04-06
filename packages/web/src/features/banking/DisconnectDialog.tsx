import { useState } from 'react';
import { useRemovePlaidItem } from '../../api/hooks/usePlaid';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AlertTriangle } from 'lucide-react';

interface Props {
  itemId: string;
  institutionName: string;
  pendingCount?: number;
  onClose: () => void;
  onRemoved: () => void;
}

export function DisconnectDialog({ itemId, institutionName, pendingCount = 0, onClose, onRemoved }: Props) {
  const [confirmName, setConfirmName] = useState('');
  const [deletePending, setDeletePending] = useState(true);
  const removeItem = useRemovePlaidItem();

  const handleDisconnect = async () => {
    await removeItem.mutateAsync({ itemId, deleteFeedItems: deletePending });
    onRemoved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <h3 className="text-lg font-semibold text-gray-900">Disconnect {institutionName}</h3>
        </div>

        <div className="space-y-3 text-sm">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800">
            <p className="font-medium">What will happen:</p>
            <ul className="mt-1 list-disc list-inside text-xs space-y-0.5">
              <li>Vibe MyBooks' access to {institutionName} will be revoked on Plaid</li>
              <li>No new transactions will be imported</li>
            </ul>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800">
            <p className="font-medium">What will NOT happen:</p>
            <ul className="mt-1 list-disc list-inside text-xs space-y-0.5">
              <li>Already categorized transactions remain in your books</li>
              <li>Your bank account in the Chart of Accounts is not deleted</li>
            </ul>
          </div>

          {pendingCount > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={deletePending}
                onChange={(e) => setDeletePending(e.target.checked)}
                className="rounded border-gray-300 text-red-600" />
              <span className="text-gray-700">Delete {pendingCount} pending (uncategorized) bank feed items</span>
            </label>
          )}

          <div>
            <p className="text-gray-600 mb-2">Type <strong>{institutionName}</strong> to confirm:</p>
            <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={institutionName} />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger"
            onClick={handleDisconnect}
            loading={removeItem.isPending}
            disabled={confirmName !== institutionName}>
            Disconnect
          </Button>
        </div>
      </div>
    </div>
  );
}
