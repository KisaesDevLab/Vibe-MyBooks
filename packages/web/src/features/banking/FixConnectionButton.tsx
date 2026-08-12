// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Repair a broken login via Plaid Link UPDATE MODE: mint an update link
// token for the item, run Link, then trigger a sync (a successful sync
// self-heals the item's error status server-side — no webhook required).
// Shared by BankConnectionsPage ("Fix Now") and the BankFeedPage error
// banner ("Update login").

import { useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { useCreateUpdateLinkToken } from '../../api/hooks/usePlaid';
import { Button } from '../../components/ui/Button';
import { apiClient } from '../../api/client';
import { Wrench } from 'lucide-react';

export function FixConnectionButton({ itemId, onRepaired, label = 'Fix Now' }: {
  itemId: string;
  onRepaired: () => void;
  label?: string;
}) {
  const createUpdateLink = useCreateUpdateLinkToken();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const startFix = async () => {
    const r = await createUpdateLink.mutateAsync(itemId);
    setLinkToken(r.linkToken);
  };
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async () => {
      setLinkToken(null);
      // Update mode repairs the existing item — no token exchange needed.
      // Kick a sync so status heals immediately instead of on the next cycle.
      try { await apiClient(`/plaid/items/${itemId}/sync`, { method: 'POST', body: JSON.stringify({}) }); } catch { /* scheduler will retry */ }
      onRepaired();
    },
    onExit: () => setLinkToken(null),
  });
  if (linkToken && ready) setTimeout(() => open(), 0);
  return (
    <Button size="sm" variant="secondary" onClick={startFix} loading={createUpdateLink.isPending}>
      <Wrench className="h-3.5 w-3.5 mr-1" />{label}
    </Button>
  );
}
