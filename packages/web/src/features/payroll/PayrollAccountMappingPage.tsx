// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect } from 'react';
import { PAYROLL_LINE_TYPE_LABELS, PayrollLineType } from '@kis-books/shared';
import { Button } from '../../components/ui/Button';
import {
  usePayrollAccountMappings,
  useSavePayrollAccountMappings,
  useAutoMapPayrollAccounts,
} from '../../api/hooks/usePayrollImport';
import { useAccounts } from '../../api/hooks/useAccounts';
import { useCompany } from '../../api/hooks/useCompany';

const LINE_TYPES = Object.values(PayrollLineType);

export function PayrollAccountMappingPage() {
  const { data: companyData } = useCompany();
  const companyId = companyData?.company?.id || '';

  const { data: mappingsData, isLoading: mappingsLoading } = usePayrollAccountMappings(companyId);
  const { data: accountsData } = useAccounts({ limit: 500 });
  const saveMutation = useSavePayrollAccountMappings();
  const autoMapMutation = useAutoMapPayrollAccounts();

  const existingMappings = mappingsData?.mappings || [];
  const allAccounts = accountsData?.data || [];

  const [localMappings, setLocalMappings] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (existingMappings.length > 0) {
      const initial: Record<string, string> = {};
      for (const m of existingMappings) {
        if (m.accountId) initial[m.lineType] = m.accountId;
      }
      setLocalMappings(initial);
    }
  }, [existingMappings]);

  const setMapping = (lineType: string, accountId: string) => {
    setLocalMappings(prev => ({ ...prev, [lineType]: accountId }));
    setDirty(true);
  };

  const handleAutoMap = async () => {
    const result = await autoMapMutation.mutateAsync(companyId);
    setLocalMappings(prev => ({ ...prev, ...result.suggestions }));
    setDirty(true);
  };

  const handleSave = async () => {
    await saveMutation.mutateAsync({ companyId, mappings: localMappings });
    setDirty(false);
  };

  const mappedCount = LINE_TYPES.filter(lt => localMappings[lt]).length;

  // Group accounts by type for organized dropdown
  const accountsByType: Record<string, typeof allAccounts> = {};
  for (const acct of allAccounts) {
    const type = acct.accountType || 'other';
    if (!accountsByType[type]) accountsByType[type] = [];
    accountsByType[type]!.push(acct);
  }

  if (!companyId) {
    return (
      <div className="p-8 text-center text-gray-500">
        Please select a company first.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Payroll Account Mapping</h1>
          <p className="text-sm text-gray-600 mt-1">
            Map each payroll line type to an account in your chart of accounts.
            {mappedCount > 0 && (
              <span className="ml-2 text-green-600">{mappedCount}/{LINE_TYPES.length} mapped</span>
            )}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={handleAutoMap} loading={autoMapMutation.isPending}>
            Auto-Map
          </Button>
          <Button onClick={handleSave} loading={saveMutation.isPending} disabled={!dirty}>
            Save Mappings
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 w-8">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Line Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">D/C</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Target Account</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {LINE_TYPES.map(lt => {
              const label = PAYROLL_LINE_TYPE_LABELS[lt] || lt;
              const currentAccount = localMappings[lt] || '';
              const isMapped = !!currentAccount;
              const isDebit = [
                PayrollLineType.GROSS_WAGES_EXPENSE,
                PayrollLineType.OFFICER_WAGES_EXPENSE,
                PayrollLineType.EMPLOYER_TAX_EXPENSE,
                PayrollLineType.EMPLOYER_BENEFITS_EXPENSE,
                PayrollLineType.CONTRACTOR_EXPENSE,
              ].includes(lt);

              return (
                <tr key={lt} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-center">
                    {isMapped ? (
                      <span className="text-green-500">&#10003;</span>
                    ) : (
                      <span className="text-gray-300">&#8211;</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{label}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                      isDebit ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {isDebit ? 'DR' : 'CR'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="w-full max-w-md rounded-md border border-gray-300 px-3 py-1.5 text-sm"
                      value={currentAccount}
                      onChange={e => setMapping(lt, e.target.value)}
                    >
                      <option value="">— Unmapped —</option>
                      {allAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.accountNumber ? `${a.accountNumber} — ` : ''}{a.name} ({a.accountType})
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {saveMutation.isSuccess && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          Account mappings saved successfully.
        </div>
      )}
    </div>
  );
}
