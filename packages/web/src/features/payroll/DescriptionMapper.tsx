import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/Button';
import { useDescriptionMap, useSaveDescriptionMap } from '../../api/hooks/usePayrollImport';
import { useAccounts } from '../../api/hooks/useAccounts';

interface Props {
  sessionId: string;
  providerKey?: string;
  onComplete: () => void;
}

export function DescriptionMapper({ sessionId, providerKey = 'payroll_relief_gl', onComplete }: Props) {
  const { data: descData, isLoading } = useDescriptionMap(sessionId);
  const { data: accountsData } = useAccounts({ limit: 500 });
  const saveMutation = useSaveDescriptionMap();

  const mappings = descData?.mappings || [];
  const allAccounts = accountsData?.data || [];

  const [localMappings, setLocalMappings] = useState<Record<string, string>>({});

  // Initialize from server data
  useEffect(() => {
    if (mappings.length > 0) {
      const initial: Record<string, string> = {};
      for (const m of mappings) {
        if (m.accountId) initial[m.sourceDescription] = m.accountId;
      }
      setLocalMappings(initial);
    }
  }, [mappings]);

  const setAccountForDesc = (desc: string, accountId: string) => {
    setLocalMappings(prev => ({ ...prev, [desc]: accountId }));
  };

  const acceptAllSuggestions = () => {
    const updated: Record<string, string> = { ...localMappings };
    for (const m of mappings) {
      if (m.status === 'suggested' && m.accountId && !updated[m.sourceDescription]) {
        updated[m.sourceDescription] = m.accountId;
      }
    }
    setLocalMappings(updated);
  };

  const unmappedCount = mappings.filter(m => !localMappings[m.sourceDescription]).length;
  const suggestedCount = mappings.filter(m => m.status === 'suggested' && !localMappings[m.sourceDescription]).length;

  const handleSave = async () => {
    const entries = Object.entries(localMappings)
      .filter(([, v]) => v)
      .map(([desc, accountId]) => ({
        sourceDescription: desc,
        accountId,
      }));

    if (entries.length === 0) return;

    await saveMutation.mutateAsync({
      sessionId,
      providerKey,
      mappings: entries,
    });
    onComplete();
  };

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Loading descriptions...</div>;
  }

  // Count JEs (unique dates)
  const uniqueDates = new Set(mappings.map(() => ''));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Description &rarr; Account Mapping</h3>
        {suggestedCount > 0 && (
          <Button variant="secondary" size="sm" onClick={acceptAllSuggestions}>
            Accept All Suggestions ({suggestedCount})
          </Button>
        )}
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Map each payroll description from the import file to an account in your chart of accounts.
        {unmappedCount > 0 && (
          <span className="text-red-600 ml-1">{unmappedCount} unmapped</span>
        )}
      </p>

      {providerKey === 'toast_je_report' && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          Tip-related descriptions (Tips Owed, Gratuity Owed) typically map to liability accounts, not expense accounts.
        </div>
      )}

      <div className="space-y-1">
        <div className="grid grid-cols-12 gap-2 py-2 text-xs font-medium text-gray-500 border-b border-gray-200">
          <div className="col-span-1">Status</div>
          <div className="col-span-4">Description</div>
          <div className="col-span-1 text-center">D/C</div>
          <div className="col-span-1 text-right">Amount</div>
          <div className="col-span-5">Account</div>
        </div>

        {mappings.map(m => {
          const currentAccountId = localMappings[m.sourceDescription] || '';
          const status = currentAccountId ? 'mapped' : m.status;
          const is1099 = m.sourceDescription.startsWith('1099');

          return (
            <div key={m.sourceDescription} className={`grid grid-cols-12 gap-2 py-2 items-center border-b border-gray-50 ${
              is1099 ? 'bg-orange-50' : ''
            }`}>
              <div className="col-span-1 text-center">
                {status === 'mapped' ? (
                  <span className="text-green-500">&#10003;</span>
                ) : status === 'suggested' ? (
                  <span className="text-yellow-500" title="Auto-suggested">&#9733;</span>
                ) : (
                  <span className="text-red-500">&#10007;</span>
                )}
              </div>
              <div className="col-span-4 text-sm font-mono truncate" title={m.sourceDescription}>
                {m.sourceDescription}
              </div>
              <div className="col-span-1 text-center">
                <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium ${
                  m.debitOrCredit === 'debit' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                }`}>
                  {m.debitOrCredit === 'debit' ? 'DR' : 'CR'}
                </span>
              </div>
              <div className="col-span-1 text-right text-sm font-mono">
                ${m.sampleAmount}
              </div>
              <div className="col-span-5">
                <select
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  value={currentAccountId}
                  onChange={e => setAccountForDesc(m.sourceDescription, e.target.value)}
                >
                  <option value="">— Select Account —</option>
                  {allAccounts.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.accountNumber ? `${a.accountNumber} — ` : ''}{a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {unmappedCount > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
          {unmappedCount} description(s) still need to be mapped before posting.
        </div>
      )}

      <div className="mt-6 flex justify-between">
        <Button variant="ghost" onClick={() => window.history.back()}>Back</Button>
        <Button onClick={handleSave} loading={saveMutation.isPending} disabled={unmappedCount > 0}>
          Save Mappings & Continue
        </Button>
      </div>
    </div>
  );
}
