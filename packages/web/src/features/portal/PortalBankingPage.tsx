// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Landmark, CreditCard, ChevronRight } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { usePortal } from './PortalLayout';

// PORTAL_BANKING_V1 — account cards with book balances. Tapping a card
// opens the sanitized register (PortalBankingRegisterPage).

export interface PortalBankAccount {
  id: string;
  name: string;
  accountNumber: string | null;
  kind: 'bank' | 'card';
  detailType: string | null;
  balance: number;
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function PortalBankingPage() {
  const { activeCompanyId } = usePortal();
  const [accounts, setAccounts] = useState<PortalBankAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 403/flag-off is an access state ("not enabled"), not a transient
  // failure — only transient failures get a Retry button.
  const [retryable, setRetryable] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    setAccounts(null);
    setError(null);
    setRetryable(false);
    fetch(`${import.meta.env.BASE_URL}api/portal/banking/accounts?companyId=${activeCompanyId}`, {
      credentials: 'include',
    })
      .then((r) => {
        if (r.status === 403) {
          if (!cancelled) setError('Bank & card activity is not enabled for your account.');
          return null;
        }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!d || cancelled) return;
        if (d.featureEnabled === false) {
          setError('Bank & card activity is not enabled for your account.');
          return;
        }
        setAccounts(d.accounts);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to load accounts.');
          setRetryable(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [activeCompanyId, attempt]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-sm text-amber-800">
          <p>{error}</p>
          {retryable && (
            <button
              onClick={() => setAttempt((a) => a + 1)}
              className="mt-2 text-sm font-medium text-amber-900 underline hover:no-underline"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Balances</h1>
      <p className="text-sm text-gray-600 mb-6">
        Your bank and credit-card accounts. Tap an account to see its activity.
      </p>

      {!accounts ? (
        <div className="py-10">
          <LoadingSpinner />
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 rounded-lg">
          <Landmark className="mx-auto h-10 w-10 text-gray-400 mb-3" />
          <p className="text-sm text-gray-500">No accounts shared yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((a) => (
            <Link
              key={a.id}
              to={`/portal/banking/${a.id}`}
              className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 active:bg-gray-50"
            >
              <div className="shrink-0 h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                {a.kind === 'card' ? (
                  <CreditCard className="h-5 w-5 text-gray-500" />
                ) : (
                  <Landmark className="h-5 w-5 text-gray-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{a.name}</p>
                <p className="text-xs text-gray-500">
                  {a.kind === 'card' ? 'Credit card' : 'Checking / Savings'}
                  {a.accountNumber ? ` · ${a.accountNumber}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900 tabular-nums">{money.format(a.balance)}</p>
                {a.kind === 'card' && <p className="text-xs text-gray-500">Balance owed</p>}
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
            </Link>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-gray-400">
        Balances reflect your books as recorded by your bookkeeper and may differ from your
        bank&apos;s available balance.
      </p>
    </div>
  );
}

export default PortalBankingPage;
