// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tenant-side designation of the suspense account.
//
// The super-admin System Accounts screen can re-point every ledger role, but
// which account holds unclassified amounts is a bookkeeping preference, not a
// support decision — so a firm's own admin owns this one. Every other role
// stays super-admin only, because getting A/R or retained earnings wrong
// breaks posting and the year-end close.

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { apiClient, isApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { useToast } from '../../components/ui/Toaster';

interface RoleAccount {
  id: string; accountNumber: string | null; name: string;
  accountType: string; detailType: string | null; isActive: boolean;
}
interface StrandedAccount {
  id: string; name: string; balance: string; lines: number; blockedReason: string | null;
}
interface RoleRow {
  tag: string; label: string; description: string;
  allowedAccountTypes: string[];
  assigned: RoleAccount | null;
}
interface Response {
  roles: RoleRow[];
  candidates: Array<{ tag: string; accounts: RoleAccount[] }>;
}

const labelFor = (a: RoleAccount) => `${a.accountNumber ? `${a.accountNumber} — ` : ''}${a.name}`;

export function SuspenseAccountPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [stranded, setStranded] = useState<{ accountId: string; accounts: StrandedAccount[] } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['tenant-settings', 'system-accounts'],
    queryFn: () => apiClient<Response>('/tenant-settings/system-accounts'),
  });

  const role = data?.roles.find((r) => r.tag === 'suspense') ?? null;
  const candidates = data?.candidates.find((c) => c.tag === 'suspense')?.accounts ?? [];

  const assign = useMutation({
    mutationFn: (vars: { accountId: string; balanceAction?: 'move' | 'leave' }) =>
      apiClient('/tenant-settings/system-accounts/suspense', {
        method: 'PUT',
        body: JSON.stringify({
          accountId: vars.accountId,
          ...(vars.balanceAction ? { balanceAction: vars.balanceAction } : {}),
        }),
      }),
    onSuccess: (_d, vars) => {
      setError(null); setStranded(null); setSelected('');
      toast.success(
        vars.balanceAction === 'move' ? 'Suspense account changed and the balance moved with it.'
          : vars.balanceAction === 'leave' ? 'Suspense account changed. The old balance was left where it was.'
          : 'Suspense account updated.',
      );
      qc.invalidateQueries({ queryKey: ['tenant-settings', 'system-accounts'] });
      qc.invalidateQueries({ queryKey: ['uncategorized'] });
      qc.invalidateQueries({ queryKey: ['accounts'] });
    },
    onError: (e: unknown, vars) => {
      if (isApiError(e) && e.code === 'SYSTEM_ACCOUNT_BALANCE_STRANDED') {
        const details = e.details as { stranded?: StrandedAccount[] } | undefined;
        setStranded({ accountId: vars.accountId, accounts: details?.stranded ?? [] });
        setError(null);
        return;
      }
      setStranded(null);
      setError(e instanceof Error ? e.message : 'Could not update the suspense account.');
    },
  });

  return (
    <div className="max-w-3xl space-y-4">
      <Link to="/settings" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> Settings
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Suspense account</h1>
        <p className="text-sm text-gray-600">
          Where amounts go when nobody has classified them yet. Because they post to a real
          account, the bank still reconciles and the balance below is exactly the work
          outstanding.
        </p>
      </header>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Currently</p>
            <p className="mt-1 text-sm text-gray-900">
              {role?.assigned
                ? labelFor(role.assigned)
                : 'Not set. One is chosen automatically the first time something needs it.'}
            </p>
          </div>

          <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-600 flex gap-2">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              An expense account keeps unclassified amounts visible on the profit and loss as a
              nag. A balance-sheet account keeps guesses out of profit entirely until someone
              decides. Both are common practice, so pick whichever your firm prefers. Bank, card
              and control accounts are not offered.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="suspense-account" className="block text-sm font-medium text-gray-700">
              Change to
            </label>
            <div className="flex gap-2 flex-wrap">
              <select
                id="suspense-account"
                value={selected}
                onChange={(e) => { setSelected(e.target.value); setError(null); setStranded(null); }}
                className="min-w-[18rem] rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">Choose an account…</option>
                {candidates.map((a) => (
                  <option key={a.id} value={a.id}>
                    {labelFor(a)} ({a.accountType.replace(/_/g, ' ')})
                  </option>
                ))}
              </select>
              <Button
                onClick={() => assign.mutate({ accountId: selected })}
                disabled={!selected || assign.isPending || selected === role?.assigned?.id}
              >
                Save
              </Button>
            </div>
            {candidates.length === 0 && (
              <p className="text-xs text-gray-500">
                No eligible accounts. Add an expense or other-current-asset account to the chart of
                accounts first.
              </p>
            )}
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          {stranded && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900 space-y-2">
              <p className="font-medium">The current suspense account still holds money.</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {stranded.accounts.map((a) => (
                  <li key={a.id}>
                    <span className="font-medium">{a.name}</span> — balance {a.balance} across {a.lines} line(s)
                    {a.blockedReason && <span> (cannot be moved: {a.blockedReason})</span>}
                  </li>
                ))}
              </ul>
              <p>
                The Uncategorized screen finds this account by its role, so leaving the balance
                behind means it stops showing up there while the money is still on the books.
              </p>
              <div className="flex gap-2 pt-1 flex-wrap">
                <Button
                  onClick={() => assign.mutate({ accountId: stranded.accountId, balanceAction: 'move' })}
                  disabled={assign.isPending || stranded.accounts.some((a) => a.blockedReason)}
                >
                  Move the balance too
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => assign.mutate({ accountId: stranded.accountId, balanceAction: 'leave' })}
                  disabled={assign.isPending}
                >
                  Leave it behind
                </Button>
                <Button variant="ghost" onClick={() => setStranded(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
