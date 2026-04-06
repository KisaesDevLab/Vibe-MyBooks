import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { useCreateTransaction } from '../../api/hooks/useTransactions';
import { AccountSelector } from '../../components/forms/AccountSelector';
import { ContactSelector, type ContactSelection } from '../../components/forms/ContactSelector';
import { Button } from '../../components/ui/Button';
import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';

interface RegisterEntryRowProps {
  accountId: string;
  accountType: string;
  allowedEntryTypes: string[];
  isBankOrCC: boolean;
}

const typeConfig: Record<string, {
  label: string;
  showPayee: boolean;
  showReceived: boolean;
  payeeType: 'vendor' | 'customer';
  accountFilter: string | string[] | undefined;
  isDeposit: boolean;
}> = {
  expense: { label: 'Check / Expense', showPayee: true, showReceived: false, payeeType: 'vendor', accountFilter: 'expense', isDeposit: false },
  deposit: { label: 'Deposit', showPayee: false, showReceived: true, payeeType: 'customer', accountFilter: 'revenue', isDeposit: true },
  transfer: { label: 'Transfer', showPayee: false, showReceived: false, payeeType: 'vendor', accountFilter: ['asset', 'liability'], isDeposit: false },
  journal_entry: { label: 'Journal Entry', showPayee: false, showReceived: false, payeeType: 'vendor', accountFilter: undefined, isDeposit: false },
};

export function RegisterEntryRow({ accountId, accountType, allowedEntryTypes, isBankOrCC }: RegisterEntryRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [txnType, setTxnType] = useState(allowedEntryTypes[0] || '');
  const [txnDate, setTxnDate] = useState(new Date().toISOString().split('T')[0]!);
  const [refNo, setRefNo] = useState('');
  const [contactId, setContactId] = useState('');
  const [otherAccountId, setOtherAccountId] = useState('');
  const [memo, setMemo] = useState('');
  const [payment, setPayment] = useState('');
  const [deposit, setDeposit] = useState('');
  const dateRef = useRef<HTMLInputElement>(null);

  const createTxn = useCreateTransaction();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isOpen && dateRef.current) dateRef.current.focus();
  }, [isOpen]);

  if (allowedEntryTypes.length === 0) return null;

  const config = typeConfig[txnType] || typeConfig['expense']!;
  const showBothAmounts = txnType === 'journal_entry';

  const reset = () => {
    setTxnDate(new Date().toISOString().split('T')[0]!);
    setRefNo('');
    setContactId('');
    setOtherAccountId('');
    setMemo('');
    setPayment('');
    setDeposit('');
  };

  const handleSave = () => {
    const amount = payment || deposit;
    if (!txnType || !amount || !otherAccountId) return;

    let payload: Record<string, unknown>;

    switch (txnType) {
      case 'expense':
        payload = { txnType: 'expense', txnDate, contactId: contactId || undefined, payFromAccountId: accountId, expenseAccountId: otherAccountId, amount, memo };
        break;
      case 'deposit':
        payload = { txnType: 'deposit', txnDate, depositToAccountId: accountId, lines: [{ accountId: otherAccountId, amount, description: memo }], memo };
        break;
      case 'transfer':
        payload = { txnType: 'transfer', txnDate, fromAccountId: accountId, toAccountId: otherAccountId, amount, memo };
        break;
      case 'journal_entry': {
        const d = payment || '0';
        const c = deposit || '0';
        payload = {
          txnType: 'journal_entry', txnDate, memo,
          lines: [
            { accountId, debit: d, credit: c },
            { accountId: otherAccountId, debit: c, credit: d },
          ],
        };
        break;
      }
      default:
        return;
    }

    createTxn.mutate(payload, {
      onSuccess: () => {
        reset();
        queryClient.invalidateQueries({ queryKey: ['register'] });
        queryClient.invalidateQueries({ queryKey: ['register-summary'] });
      },
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { reset(); setIsOpen(false); }
  };

  // Collapsed state — just a button
  if (!isOpen) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-white border-b-2 border-blue-200">
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center gap-2 px-5 py-3 text-sm font-medium text-primary-600 hover:bg-blue-100/50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add transaction to register
        </button>
      </div>
    );
  }

  // Expanded inline entry form
  return (
    <div className="bg-blue-50 border-b-2 border-blue-300" onKeyDown={handleKeyDown}>
      {/* Transaction type tabs */}
      <div className="flex items-center border-b border-blue-200 px-4 pt-3 pb-0">
        {allowedEntryTypes.map((t) => (
          <button
            key={t}
            onClick={() => { setTxnType(t); reset(); }}
            className={`px-4 py-2 text-xs font-semibold rounded-t-lg mr-1 transition-colors ${
              txnType === t
                ? 'bg-white text-primary-700 border border-blue-200 border-b-white -mb-px'
                : 'text-gray-500 hover:text-gray-700 hover:bg-blue-100/50'
            }`}
          >
            {typeConfig[t]?.label || t}
          </button>
        ))}
        <button onClick={() => { reset(); setIsOpen(false); }} className="ml-auto text-xs text-gray-400 hover:text-gray-600 pb-2">
          Close
        </button>
      </div>

      {/* Entry fields — two-row layout */}
      <div className="bg-white border-l-4 border-primary-500 mx-4 my-3 rounded-lg shadow-sm p-4 space-y-3">
        {/* Row 1: Date, Ref, Payee/Received, Account */}
        <div className="flex gap-3">
          <div className="w-36">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Date</label>
            <input
              ref={dateRef}
              type="date"
              value={txnDate}
              onChange={(e) => setTxnDate(e.target.value)}
              className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          <div className="w-24">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Ref #</label>
            <input
              value={refNo}
              onChange={(e) => setRefNo(e.target.value)}
              placeholder="—"
              className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          {(config.showPayee || config.showReceived) && (
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                {config.showPayee ? 'Payee' : 'Received From'}
              </label>
              <ContactSelector value={contactId} onChange={setContactId} contactTypeFilter={config.payeeType}
                onSelect={(c) => { if (c?.defaultExpenseAccountId && !otherAccountId) setOtherAccountId(c.defaultExpenseAccountId); }} />
            </div>
          )}

          <div className="flex-1 min-w-[160px]">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
              {txnType === 'transfer' ? 'Transfer To Account' : 'Category / Account'}
            </label>
            <AccountSelector
              value={otherAccountId}
              onChange={setOtherAccountId}
              accountTypeFilter={config.accountFilter as any}
              required
            />
          </div>
        </div>

        {/* Row 2: Memo, Payment, Deposit, Save */}
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Memo / Description</label>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="What's this for?"
              className="w-full rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
            />
          </div>

          {/* Payment / Decrease */}
          {!config.isDeposit && (
            <div className="w-32">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                {isBankOrCC ? 'Payment' : 'Decrease'}
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={payment}
                  onChange={(e) => { setPayment(e.target.value); if (!showBothAmounts) setDeposit(''); }}
                  placeholder="0.00"
                  className="w-full rounded border border-gray-300 pl-6 pr-2.5 py-1.5 text-sm text-right font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Deposit / Increase */}
          {(config.isDeposit || showBothAmounts) && (
            <div className="w-32">
              <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                {isBankOrCC ? 'Deposit' : 'Increase'}
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={deposit}
                  onChange={(e) => { setDeposit(e.target.value); if (!showBothAmounts) setPayment(''); }}
                  placeholder="0.00"
                  className="w-full rounded border border-gray-300 pl-6 pr-2.5 py-1.5 text-sm text-right font-mono focus:border-primary-500 focus:ring-1 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={(!payment && !deposit) || !otherAccountId || createTxn.isPending}
              loading={createTxn.isPending}
              size="sm"
            >
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => reset()}>
              Clear
            </Button>
          </div>
        </div>

        {createTxn.error && (
          <p className="text-xs text-red-600">{createTxn.error.message}</p>
        )}
      </div>

      <div className="px-4 pb-2">
        <p className="text-[10px] text-gray-400">
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-500 text-[10px]">Enter</kbd> save &nbsp;
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-500 text-[10px]">Tab</kbd> next field &nbsp;
          <kbd className="px-1 py-0.5 bg-gray-100 rounded text-gray-500 text-[10px]">Esc</kbd> close
        </p>
      </div>
    </div>
  );
}
