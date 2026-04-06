import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client';
import { useAssignPlaidAccount } from '../../api/hooks/usePlaid';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { CheckCircle } from 'lucide-react';

interface Props {
  accounts: any[];
  hiddenAccountCount?: number;
  onClose: () => void;
  onComplete: () => void;
}

const QUICK_DATES = [
  { label: 'Jan 1', value: () => `${new Date().getFullYear()}-01-01` },
  { label: 'This month', value: () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; } },
  { label: 'All history', value: () => '' },
];

export function PlaidMappingWizard({ accounts, hiddenAccountCount = 0, onClose, onComplete }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [mappings, setMappings] = useState<Record<string, { tenantId: string; coaAccountId: string; syncStartDate: string; skip: boolean }>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const assignAccount = useAssignPlaidAccount();

  // User's accessible companies
  const { data: authData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiClient<any>('/auth/me'),
  });
  const accessibleTenants: Array<{ tenantId: string; tenantName: string }> = authData?.accessibleTenants || [];
  const hasMultipleCompanies = accessibleTenants.length > 1;

  // COA accounts for the current tenant
  const { data: coaData } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient<{ data: any[] }>('/accounts?limit=500'),
  });
  const coaAccounts = (coaData?.data || []).filter((a: any) =>
    ['bank', 'credit_card', 'other_current_asset', 'other_current_liability'].includes(a.detailType),
  );

  const unassigned = accounts.filter((a: any) => !a.mapping);
  const assigned = accounts.filter((a: any) => a.mapping);

  const getMapping = (id: string) => mappings[id] || { tenantId: '', coaAccountId: '', syncStartDate: QUICK_DATES[1]!.value(), skip: false };
  const setField = (id: string, field: string, value: any) => {
    setMappings((m) => ({ ...m, [id]: { ...getMapping(id), [field]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    for (const acct of unassigned) {
      const m = getMapping(acct.id);
      if (m.skip || !m.coaAccountId) continue;
      await assignAccount.mutateAsync({
        accountId: acct.id,
        tenantId: m.tenantId || undefined,
        coaAccountId: m.coaAccountId,
        syncStartDate: m.syncStartDate || null,
      });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(onComplete, 1000);
  };

  const mappedCount = unassigned.filter((a) => !getMapping(a.id).skip && getMapping(a.id).coaAccountId).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        {saved ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900">Accounts Mapped</h3>
            <p className="text-sm text-gray-500 mt-1">Sync will begin shortly.</p>
          </div>
        ) : (
          <>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {step === 1 ? 'Step 1: Select Accounts' : 'Step 2: Map to Chart of Accounts'}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {step === 1 ? 'Choose which accounts to import.' : 'Assign each account to a COA entry and set a sync start date.'}
            </p>

            {hiddenAccountCount > 0 && (
              <p className="text-xs text-gray-400 mb-4">{hiddenAccountCount} other account{hiddenAccountCount > 1 ? 's' : ''} assigned to other companies</p>
            )}

            {/* Already assigned */}
            {assigned.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Already Mapped</p>
                {assigned.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between py-1.5 text-sm text-gray-600">
                    <span>{a.name} {a.mask && `(****${a.mask})`}</span>
                    <span className="text-green-600 text-xs">Mapped</span>
                  </div>
                ))}
              </div>
            )}

            {/* Unassigned accounts */}
            {unassigned.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Available Accounts</p>
                {unassigned.map((acct: any) => {
                  const m = getMapping(acct.id);
                  return (
                    <div key={acct.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{acct.name} {acct.mask && `(****${acct.mask})`}</p>
                          <p className="text-xs text-gray-500">{acct.accountType} · {acct.accountSubtype}
                            {acct.currentBalance && ` · Balance: $${parseFloat(acct.currentBalance).toFixed(2)}`}
                          </p>
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                          <input type="checkbox" checked={m.skip} onChange={(e) => setField(acct.id, 'skip', e.target.checked)} className="rounded border-gray-300" />
                          Skip
                        </label>
                      </div>

                      {!m.skip && (
                        <div className="space-y-3">
                          {hasMultipleCompanies && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                              <select className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                value={m.tenantId} onChange={(e) => setField(acct.id, 'tenantId', e.target.value)}>
                                <option value="">Current company</option>
                                {accessibleTenants.map((t) => (
                                  <option key={t.tenantId} value={t.tenantId}>{t.tenantName}</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Chart of Accounts</label>
                            <select className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                              value={m.coaAccountId} onChange={(e) => setField(acct.id, 'coaAccountId', e.target.value)}>
                              <option value="">Select account...</option>
                              {coaAccounts.map((a: any) => (
                                <option key={a.id} value={a.id}>{a.accountNumber ? `${a.accountNumber} - ` : ''}{a.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Import transactions from</label>
                            <div className="flex items-center gap-2">
                              <input type="date" className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm flex-1"
                                value={m.syncStartDate} onChange={(e) => setField(acct.id, 'syncStartDate', e.target.value)} />
                              {QUICK_DATES.map((qd) => (
                                <button key={qd.label} type="button" onClick={() => setField(acct.id, 'syncStartDate', qd.value())}
                                  className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">{qd.label}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {unassigned.length === 0 && assigned.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No accounts available to map.</p>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSave} loading={saving} disabled={mappedCount === 0}>
                Save & Start Syncing ({mappedCount} account{mappedCount !== 1 ? 's' : ''})
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
