import { useNavigate } from 'react-router-dom';
import { useAccounts } from '../../api/hooks/useAccounts';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { Landmark, CreditCard, Wallet, ScrollText } from 'lucide-react';
import type { Account } from '@kis-books/shared';

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

const iconMap: Record<string, React.ElementType> = {
  bank: Landmark,
  credit_card: CreditCard,
};

function AccountGroup({ title, accounts, icon: Icon }: { title: string; accounts: Account[]; icon: React.ElementType }) {
  const navigate = useNavigate();
  if (accounts.length === 0) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary-600" />
        <h2 className="font-semibold text-gray-800">{title}</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {accounts.map((a) => (
          <button
            key={a.id}
            onClick={() => navigate(`/accounts/${a.id}/register`)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors text-left"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{a.name}</p>
              <p className="text-xs text-gray-500">{a.accountNumber ? `#${a.accountNumber}` : a.detailType?.replace(/_/g, ' ')}</p>
            </div>
            <span className={`text-sm font-mono font-medium ${parseFloat(a.balance) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
              {fmt(parseFloat(a.balance))}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function RegistersPage() {
  const { data, isLoading } = useAccounts({ isActive: true, limit: 200, offset: 0 });

  if (isLoading) return <LoadingSpinner className="py-12" />;

  const allAccounts = data?.data || [];
  const bankAccounts = allAccounts.filter((a) => a.detailType === 'bank');
  const ccAccounts = allAccounts.filter((a) => a.detailType === 'credit_card');
  const otherAssets = allAccounts.filter((a) => a.accountType === 'asset' && a.detailType !== 'bank' && a.detailType !== 'accounts_receivable');
  const liabilities = allAccounts.filter((a) => a.accountType === 'liability' && a.detailType !== 'credit_card');
  const equity = allAccounts.filter((a) => a.accountType === 'equity');

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Registers</h1>
      <p className="text-sm text-gray-500 mb-6">Select an account to view its transaction register.</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AccountGroup title="Bank Accounts" accounts={bankAccounts} icon={Landmark} />
        <AccountGroup title="Credit Cards" accounts={ccAccounts} icon={CreditCard} />
        <AccountGroup title="Other Assets" accounts={otherAssets} icon={Wallet} />
        <AccountGroup title="Liabilities" accounts={liabilities} icon={ScrollText} />
        <AccountGroup title="Equity" accounts={equity} icon={ScrollText} />
      </div>
    </div>
  );
}
