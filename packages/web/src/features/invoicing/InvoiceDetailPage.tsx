// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInvoice, useVoidInvoice, useDuplicateInvoice } from '../../api/hooks/useInvoices';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { RecordPaymentModal } from './RecordPaymentModal';
import { SendInvoiceModal } from './SendInvoiceModal';
import { Send, DollarSign, Download, Copy, Ban, CheckCircle, Pencil } from 'lucide-react';
import { AttachmentPanel } from '../attachments/AttachmentPanel';
import { ShareLinkButton } from './ShareLinkButton';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  partial: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  void: 'bg-red-100 text-red-700',
};

const statusSteps = ['draft', 'sent', 'partial', 'paid'];

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useInvoice(id!);
  const voidInvoice = useVoidInvoice();
  const duplicateInvoice = useDuplicateInvoice();

  const queryClient = useQueryClient();
  const [showPayment, setShowPayment] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const markAsSent = useMutation({
    mutationFn: () => apiClient(`/invoices/${id}/mark-sent`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', id] });
      refetch();
    },
  });

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError || !data) return <ErrorMessage onRetry={() => refetch()} />;

  const inv = data.invoice;
  const lines = inv.lines || [];
  const revenueLines = lines.filter((l) => parseFloat(l.credit) > 0);
  const currentStep = statusSteps.indexOf(inv.invoiceStatus || 'draft');

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    setPdfError('');
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(`/api/v1/invoices/${inv.id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to generate PDF');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `invoice-${inv.txnNumber || inv.id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      setPdfError(err instanceof Error ? err.message : 'PDF download failed');
    }
    setPdfLoading(false);
  };

  return (
    <div>
      {pdfError && (
        <div role="alert" className="mb-3 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          <span>{pdfError}</span>
          <button onClick={() => setPdfError('')} className="text-xs underline text-red-600 hover:text-red-800">Dismiss</button>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoice {inv.txnNumber ? `#${inv.txnNumber}` : ''}</h1>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${statusColors[inv.invoiceStatus || 'draft'] || ''}`}>
            {inv.invoiceStatus || 'draft'}
          </span>
        </div>
        <div className="flex gap-2">
          {inv.invoiceStatus !== 'void' && inv.invoiceStatus !== 'paid' && (
            <>
              <Button variant="secondary" size="sm" onClick={() => navigate(`/invoices/${inv.id}/edit`)}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
              {inv.invoiceStatus === 'draft' && (
                <Button variant="secondary" size="sm" onClick={() => markAsSent.mutate()} loading={markAsSent.isPending}>
                  <CheckCircle className="h-4 w-4 mr-1" /> Mark as Sent
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setShowSend(true)}>
                <Send className="h-4 w-4 mr-1" /> Send
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowPayment(true)}>
                <DollarSign className="h-4 w-4 mr-1" /> Record Payment
              </Button>
            </>
          )}
          <ShareLinkButton
            invoiceId={inv.id}
            invoiceNumber={inv.txnNumber || undefined}
            total={inv.total || undefined}
            contactPhone={inv.contactPhone ?? undefined}
          />
          <Button variant="secondary" size="sm" onClick={handleDownloadPdf} loading={pdfLoading}>
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button variant="secondary" size="sm" onClick={() => duplicateInvoice.mutate(inv.id, { onSuccess: () => navigate('/invoices') })}>
            <Copy className="h-4 w-4 mr-1" /> Duplicate
          </Button>
          {inv.invoiceStatus !== 'void' && (
            <Button variant="danger" size="sm" onClick={() => setShowVoid(true)}>
              <Ban className="h-4 w-4 mr-1" /> Void
            </Button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-2 mb-6">
        {statusSteps.map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              i <= currentStep ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-500'
            }`}>{i + 1}</div>
            <span className={`text-xs capitalize ${i <= currentStep ? 'text-primary-600 font-medium' : 'text-gray-400'}`}>{step}</span>
            {i < statusSteps.length - 1 && <div className={`w-8 h-0.5 ${i < currentStep ? 'bg-primary-600' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Preview */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="flex justify-between mb-6">
            <div>
              <p className="text-sm text-gray-500">Date: {inv.txnDate}</p>
              {inv.dueDate && <p className="text-sm text-gray-500">Due: {inv.dueDate}</p>}
              {inv.paymentTerms && <p className="text-sm text-gray-500">Terms: {inv.paymentTerms.replace(/_/g, ' ')}</p>}
            </div>
          </div>

          <table className="min-w-full text-sm mb-6">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Description</th>
                <th className="text-center py-2">Qty</th>
                <th className="text-right py-2">Rate</th>
                <th className="text-right py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {revenueLines.map((line) => (
                <tr key={line.id} className="border-b border-gray-100">
                  <td className="py-2">{line.description || '—'}</td>
                  <td className="py-2 text-center">{line.quantity || '1'}</td>
                  <td className="py-2 text-right font-mono">${parseFloat(line.unitPrice || '0').toFixed(2)}</td>
                  <td className="py-2 text-right font-mono">${parseFloat(line.credit).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-64 space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">${parseFloat(inv.subtotal || '0').toFixed(2)}</span></div>
              {parseFloat(inv.taxAmount || '0') > 0 && (
                <div className="flex justify-between"><span>Tax</span><span className="font-mono">${parseFloat(inv.taxAmount || '0').toFixed(2)}</span></div>
              )}
              <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span className="font-mono">${parseFloat(inv.total || '0').toFixed(2)}</span></div>
              {parseFloat(inv.amountPaid || '0') > 0 && (
                <>
                  <div className="flex justify-between text-green-600"><span>Paid</span><span className="font-mono">-${parseFloat(inv.amountPaid || '0').toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold"><span>Balance Due</span><span className="font-mono">${parseFloat(inv.balanceDue || '0').toFixed(2)}</span></div>
                </>
              )}
            </div>
          </div>

          {inv.memo && (
            <div className="mt-6 p-3 bg-gray-50 rounded-lg text-sm">
              <strong>Notes:</strong> {inv.memo}
            </div>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-mono font-medium">${parseFloat(inv.total || '0').toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Paid</span><span className="font-mono">${parseFloat(inv.amountPaid || '0').toFixed(2)}</span></div>
              <div className="flex justify-between font-medium border-t pt-1"><span>Balance Due</span><span className="font-mono">${parseFloat(inv.balanceDue || '0').toFixed(2)}</span></div>
            </div>
          </div>
          <AttachmentPanel attachableType="invoice" attachableId={inv.id} />
        </div>
      </div>

      {/* Modals */}
      {showPayment && <RecordPaymentModal invoice={inv} onClose={() => { setShowPayment(false); refetch(); }} />}
      {showSend && <SendInvoiceModal invoice={inv} onClose={() => { setShowSend(false); refetch(); }} />}

      {showVoid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
            <h2 className="text-lg font-semibold">Void Invoice</h2>
            <textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Reason..." className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" rows={3} />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setShowVoid(false)}>Cancel</Button>
              <Button variant="danger" disabled={!voidReason.trim()} loading={voidInvoice.isPending}
                onClick={() => voidInvoice.mutate({ id: inv.id, reason: voidReason }, { onSuccess: () => { setShowVoid(false); refetch(); } })}>Void</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
