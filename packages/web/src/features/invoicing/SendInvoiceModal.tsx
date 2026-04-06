import { useState, type FormEvent } from 'react';
import type { Transaction } from '@kis-books/shared';
import { useSendInvoice } from '../../api/hooks/useInvoices';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { X } from 'lucide-react';

interface SendInvoiceModalProps {
  invoice: Transaction;
  customerEmail?: string;
  onClose: () => void;
}

export function SendInvoiceModal({ invoice, customerEmail, onClose }: SendInvoiceModalProps) {
  const [email, setEmail] = useState(customerEmail || '');
  const sendInvoice = useSendInvoice();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendInvoice.mutate(invoice.id, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Send Invoice</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input label="To Email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />

          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
            <p>Invoice {invoice.txnNumber || invoice.id.slice(0, 8)} for ${parseFloat(invoice.total || '0').toFixed(2)}</p>
            <p className="text-gray-500 mt-1">PDF will be attached to the email.</p>
          </div>

          {sendInvoice.error && <p className="text-sm text-red-600">{sendInvoice.error.message}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={sendInvoice.isPending}>Send Invoice</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
