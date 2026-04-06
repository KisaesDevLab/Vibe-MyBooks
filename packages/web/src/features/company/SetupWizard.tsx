import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { accountingMethods } from '@kis-books/shared';
import { useUpdateCompany, useMarkSetupComplete } from '../../api/hooks/useCompany';
import { useAccounts } from '../../api/hooks/useAccounts';
import { Button } from '../../components/ui/Button';
import { CheckCircle } from 'lucide-react';

const steps = ['Accounting', 'Chart of Accounts', 'Done'];

export function SetupWizard() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    fiscalYearStartMonth: 1,
    accountingMethod: 'accrual',
  });

  const navigate = useNavigate();
  const updateCompany = useUpdateCompany();
  const markComplete = useMarkSetupComplete();
  const { data: accountsData } = useAccounts({ limit: 200, offset: 0 });

  const set = (field: string) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleNext = () => {
    if (step === 0) {
      updateCompany.mutate({
        fiscalYearStartMonth: Number(form.fiscalYearStartMonth),
        accountingMethod: form.accountingMethod as 'cash' | 'accrual',
      }, { onSuccess: () => setStep(1) });
    } else if (step === 1) {
      setStep(2);
    } else {
      markComplete.mutate(undefined, {
        onSuccess: () => {
          sessionStorage.setItem('setupDismissed', 'true');
          navigate('/');
        },
      });
    }
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Vibe MyBooks</h1>
          <p className="mt-2 text-gray-600">Let's finish setting up your company</p>
          <button
            onClick={() => { sessionStorage.setItem('setupDismissed', 'true'); navigate('/'); }}
            className="mt-2 text-sm text-gray-400 hover:text-gray-600 underline"
          >
            Skip for now
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((label, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i < step ? 'bg-green-500 text-white' : i === step ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {i < step ? <CheckCircle className="h-5 w-5" /> : i + 1}
              </div>
              {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < step ? 'bg-green-500' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Accounting Preferences</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fiscal Year Start</label>
                <select value={form.fiscalYearStartMonth} onChange={set('fiscalYearStartMonth')} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Accounting Method</label>
                <select value={form.accountingMethod} onChange={set('accountingMethod')} className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  {accountingMethods.map((m) => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Most small businesses use cash basis. Consult your accountant if unsure.
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Chart of Accounts</h2>
              <p className="text-sm text-gray-600">
                Your chart of accounts has been set up based on your business type. You can customize it anytime from the sidebar.
              </p>
              {accountsData && (
                <div className="border rounded-lg max-h-64 overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left">#</th>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-left">Type</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {accountsData.data.map((a) => (
                        <tr key={a.id}>
                          <td className="px-4 py-1.5 text-gray-500">{a.accountNumber}</td>
                          <td className="px-4 py-1.5">{a.name}</td>
                          <td className="px-4 py-1.5 capitalize text-gray-500">{a.accountType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="text-center py-6 space-y-4">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              <h2 className="text-lg font-semibold">You're all set!</h2>
              <p className="text-sm text-gray-600">
                Your company is configured and ready to go. You can always change settings later.
              </p>
            </div>
          )}

          <div className="flex justify-between mt-6">
            {step > 0 && step < 2 ? (
              <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>Back</Button>
            ) : <div />}
            <Button onClick={handleNext} loading={updateCompany.isPending || markComplete.isPending}>
              {step === 2 ? 'Go to Dashboard' : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
