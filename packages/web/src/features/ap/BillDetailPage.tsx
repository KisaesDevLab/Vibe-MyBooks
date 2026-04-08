import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBill, useVoidBill } from '../../api/hooks/useAp';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

const STATUS_COLORS: Record<string, string> = {
  unpaid: 'bg-yellow-100 text-yellow-800',
  partial: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
};

export function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useBill(id || '');
  const voidBill = useVoidBill();
  const [showVoid, setShowVoid] = useState(false);
  const [voidReason, setVoidReason] = useState('');

  if (isLoading) return <LoadingSpinner className="py-12" />;
  const bill = data?.bill;
  if (!bill) return <p>Bill not found.</p>;

  const isVoid = bill.status === 'void';
  const status = bill.billStatus || 'unpaid';

  const expenseLines = (bill.lines || []).filter((l: any) => parseFloat(l.debit) > 0);

  const handleVoid = () => {
    if (!voidReason) return;
    voidBill.mutate({ id: id!, reason: voidReason }, {
      onSuccess: () => navigate('/bills'),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bill {bill.txnNumber}
            <span className={`ml-3 inline-block px-2 py-0.5 text-xs rounded align-middle ${STATUS_COLORS[status] || ''}`}>
              {status.toUpperCase()}
            </span>
            {isVoid && <span className="ml-2 inline-block px-2 py-0.5 text-xs rounded bg-gray-200 text-gray-700 align-middle">VOID</span>}
          </h1>
        </div>
        <div className="flex gap-2">
          {!isVoid && status === 'unpaid' && (
            <>
              <Button variant="secondary" onClick={() => navigate(`/bills/${id}/edit`)}>Edit</Button>
              <Button variant="danger" onClick={() => setShowVoid(true)}>Void</Button>
            </>
          )}
          <Button onClick={() => navigate('/pay-bills')}>Pay Bill</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-gray-500 text-xs uppercase">Vendor</div>
            <div className="font-medium">{bill.contactId ? '(see contact)' : '—'}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase">Bill Date</div>
            <div>{bill.txnDate}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase">Due Date</div>
            <div>{bill.dueDate || '—'}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase">Vendor Invoice #</div>
            <div>{bill.vendorInvoiceNumber || '—'}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase">Payment Terms</div>
            <div>{bill.paymentTerms || '—'}</div>
          </div>
          <div>
            <div className="text-gray-500 text-xs uppercase">Memo</div>
            <div>{bill.memo || '—'}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-4">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Expense Lines</h2>
        <table className="min-w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2">Account</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase pb-2">Description</th>
              <th className="text-right text-xs font-medium text-gray-500 uppercase pb-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenseLines.map((line: any) => (
              <tr key={line.id} className="border-b last:border-0">
                <td className="py-2 text-sm">{line.accountNumber} {line.accountName}</td>
                <td className="py-2 text-sm">{line.description || '—'}</td>
                <td className="py-2 text-sm text-right font-mono">${parseFloat(line.debit).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex justify-end">
          <div className="w-72 space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Total</span>
              <span className="font-mono">${parseFloat(bill.total || '0').toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Amount Paid</span>
              <span className="font-mono">${parseFloat(bill.amountPaid || '0').toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Credits Applied</span>
              <span className="font-mono">${parseFloat(bill.creditsApplied || '0').toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Balance Due</span>
              <span className="font-mono">${parseFloat(bill.balanceDue || '0').toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {showVoid && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="font-bold mb-3">Void Bill</h3>
            <p className="text-sm text-gray-600 mb-3">
              Voiding a bill will reverse its journal entries. This action cannot be undone.
            </p>
            <textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason for voiding"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-3"
              rows={3}
            />
            <div className="flex gap-2">
              <Button variant="danger" onClick={handleVoid} loading={voidBill.isPending} disabled={!voidReason}>
                Void Bill
              </Button>
              <Button variant="secondary" onClick={() => setShowVoid(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
