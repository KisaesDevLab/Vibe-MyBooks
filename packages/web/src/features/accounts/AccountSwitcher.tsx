// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useNavigate } from 'react-router-dom';
import { useAccounts } from '../../api/hooks/useAccounts';
import type { Account } from '@kis-books/shared';

interface AccountSwitcherProps {
  currentAccountId: string;
}

export function AccountSwitcher({ currentAccountId }: AccountSwitcherProps) {
  const navigate = useNavigate();
  const { data } = useAccounts({ isActive: true, limit: 200, offset: 0 });
  const allAccounts = data?.data || [];

  // Only show balance sheet accounts (asset, liability, equity)
  const balanceSheetAccounts = allAccounts.filter((a) =>
    ['asset', 'liability', 'equity'].includes(a.accountType),
  );

  const grouped = new Map<string, Account[]>();
  for (const a of balanceSheetAccounts) {
    const type = a.detailType || a.accountType;
    if (!grouped.has(type)) grouped.set(type, []);
    grouped.get(type)!.push(a);
  }

  return (
    <select
      value={currentAccountId}
      onChange={(e) => navigate(`/accounts/${e.target.value}/register`)}
      className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium"
    >
      {[...grouped.entries()].map(([type, accts]) => (
        <optgroup key={type} label={type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}>
          {accts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.accountNumber ? `${a.accountNumber} — ` : ''}{a.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
