// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Amber banner for pages that consume the bank feed: shows every Plaid
// connection visible to this tenant whose login broke, with "Update login"
// (in-app Link update mode) and "Email fix link" (repair invite to the
// client of record). Renders nothing while all connections are healthy.

import { usePlaidItems, useSendRepairInvite } from '../../api/hooks/usePlaid';
import { useFeatureFlag } from '../../api/hooks/useFeatureFlag';
import { useToast } from '../../components/ui/Toaster';
import { Button } from '../../components/ui/Button';
import { FixConnectionButton } from './FixConnectionButton';
import { AlertTriangle, Send } from 'lucide-react';

const BROKEN_STATUSES = new Set(['login_required', 'error']);

export function BankConnectionErrorBanner() {
  const toast = useToast();
  const { data, refetch } = usePlaidItems();
  const invitesEnabled = useFeatureFlag('BANK_CONNECT_INVITES_V1') === true;
  const sendRepair = useSendRepairInvite();

  const broken = (data?.items ?? []).filter((i) => BROKEN_STATUSES.has(i.itemStatus));
  if (broken.length === 0) return null;

  const emailFix = async (itemId: string) => {
    try {
      const r = await sendRepair.mutateAsync({ itemId });
      toast.success(`Fix-login link sent to ${r.recipientName} (${r.channels.join(' + ')})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the fix link');
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <p className="text-sm font-medium text-amber-800">
          {broken.length === 1
            ? `${broken[0]!.institutionName || 'A bank'} connection needs attention — new transactions are not importing.`
            : `${broken.length} bank connections need attention — new transactions are not importing.`}
        </p>
      </div>
      {broken.map((item) => (
        <div key={item.id} className="mt-2 flex items-center justify-between gap-2">
          <span className="text-sm text-amber-700">
            {item.institutionName} — {item.errorMessage || item.itemStatus.replace(/_/g, ' ')}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {invitesEnabled && (
              <Button size="sm" variant="secondary" onClick={() => emailFix(item.id)} loading={sendRepair.isPending}>
                <Send className="h-3.5 w-3.5 mr-1" />Email fix link
              </Button>
            )}
            <FixConnectionButton
              itemId={item.id}
              label="Update login"
              onRepaired={() => { toast.success('Connection repaired — syncing now.'); void refetch(); }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
