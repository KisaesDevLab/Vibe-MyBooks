// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Account, PlaidAccount } from '@kis-books/shared';
import { apiClient } from '../../api/client';
import { useMapPlaidAccount, usePlaidAccountSuggestions } from '../../api/hooks/usePlaid';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

interface Props {
  accounts: PlaidAccount[];
  onClose: () => void;
  onComplete: () => void;
}

export function AccountMappingModal({ accounts, onClose, onComplete }: Props) {
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const mapAccount = useMapPlaidAccount();
  const [saving, setSaving] = useState(false);

  // Fetch COA accounts for mapping
  const { data: coaData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient<{ data: Account[] }>('/accounts?limit=500'),
  });
  const coaAccounts = coaData?.data || [];

  const handleSave = async () => {
    setSaving(true);
    for (const acct of accounts) {
      const coaId = mappings[acct.id];
      if (coaId && !skipped.has(acct.id)) {
        await mapAccount.mutateAsync({ accountId: acct.id, coaAccountId: coaId });
      }
    }
    setSaving(false);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Map Bank Accounts</h3>
        <p className="text-sm text-gray-500 mb-4">Link each bank account to a Chart of Accounts entry. You can skip accounts you don't want to import.</p>

        <div className="space-y-4">
          {accounts.map((acct) => (
            <div key={acct.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{acct.name} {acct.mask && `(****${acct.mask})`}</p>
                  <p className="text-xs text-gray-500">{acct.accountType} · {acct.accountSubtype}</p>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" checked={skipped.has(acct.id)}
                    onChange={(e) => {
                      const s = new Set(skipped);
                      e.target.checked ? s.add(acct.id) : s.delete(acct.id);
                      setSkipped(s);
                    }}
                    className="rounded border-gray-300" />
                  Skip
                </label>
              </div>
              {!skipped.has(acct.id) && (
                <select
                  className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  value={mappings[acct.id] || ''}
                  onChange={(e) => setMappings((m) => ({ ...m, [acct.id]: e.target.value }))}
                >
                  <option value="">Select an account...</option>
                  {coaAccounts
                    .filter((a) => ['bank', 'credit_card', 'other_current_asset', 'other_current_liability'].includes(a.detailType ?? ''))
                    .map((a) => (
                      <option key={a.id} value={a.id}>{a.accountNumber ? `${a.accountNumber} - ` : ''}{a.name}</option>
                    ))}
                </select>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>Skip for Now</Button>
          <Button onClick={handleSave} loading={saving}>Save Mappings</Button>
        </div>
      </div>
    </div>
  );
}
