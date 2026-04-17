// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useMapPlaidAccount, usePlaidAccountSuggestions } from '../../api/hooks/usePlaid';
import { Button } from '../../components/ui/Button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  account: any;
  onClose: () => void;
  onSaved: () => void;
}

export function RemapAccountModal({ account, onClose, onSaved }: Props) {
  const [selectedCoaId, setSelectedCoaId] = useState(account.mappedAccountId || '');
  const mapAccount = useMapPlaidAccount();
  const { data: suggestionsData } = usePlaidAccountSuggestions(account.id);

  const { data: coaData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient<{ data: any[] }>('/accounts?limit=500'),
  });
  const coaAccounts = coaData?.data || [];
  const suggestions = suggestionsData?.suggestions || [];

  const handleSave = async () => {
    if (selectedCoaId) {
      await mapAccount.mutateAsync({ accountId: account.id, coaAccountId: selectedCoaId });
    } else {
      // Unmap
      await apiClient(`/plaid/accounts/${account.id}`, {
        method: 'PUT',
        body: JSON.stringify({ mappedAccountId: null }),
      });
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Remap: {account.name} {account.mask && `(****${account.mask})`}
        </h3>
        <p className="text-xs text-gray-500 mb-4">{account.accountType} · {account.accountSubtype}</p>

        {account.isMapped && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 mb-4">
            <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
            Changing the mapping affects where future transactions are imported. Existing transactions in the bank feed will not be moved.
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Map to Account</label>
            <select
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={selectedCoaId}
              onChange={(e) => setSelectedCoaId(e.target.value)}
            >
              <option value="">Not mapped (stop importing)</option>
              {suggestions.length > 0 && (
                <optgroup label="Suggested">
                  {suggestions.map((s: any) => (
                    <option key={s.coaAccountId} value={s.coaAccountId}>
                      {s.coaAccountNumber ? `${s.coaAccountNumber} - ` : ''}{s.coaAccountName} ({s.confidence})
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="All Accounts">
                {coaAccounts
                  .filter((a: any) => ['bank', 'credit_card', 'other_current_asset', 'other_current_liability'].includes(a.detailType))
                  .map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.accountNumber ? `${a.accountNumber} - ` : ''}{a.name}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>
        </div>

        {mapAccount.error && <p className="text-sm text-red-600 mt-2">{(mapAccount.error as any).message}</p>}

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} loading={mapAccount.isPending}>Save Mapping</Button>
        </div>
      </div>
    </div>
  );
}
