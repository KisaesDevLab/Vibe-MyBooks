// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { StripePaymentForm } from './StripePaymentForm';
import { PaymentSuccessView } from './PaymentSuccessView';

interface InvoiceLine {
  description: string | null;
  quantity: string | null;
  unitPrice: string | null;
  amount: string | null;
}

interface PublicInvoice {
  invoiceId: string;
  txnNumber: string | null;
  txnDate: string;
  dueDate: string | null;
  invoiceStatus: string | null;
  memo: string | null;
  paymentTerms: string | null;
  subtotal: string | null;
  taxAmount: string | null;
  total: string | null;
  amountPaid: string | null;
  balanceDue: string | null;
  companyName: string;
  companyAddress: { line1: string | null; line2: string | null; city: string | null; state: string | null; zip: string | null };
  companyPhone: string | null;
  companyEmail: string | null;
  companyLogoUrl: string | null;
  customerName: string | null;
  customerEmail: string | null;
  stripePublishableKey: string | null;
  onlinePaymentsEnabled: boolean;
  currency?: string | null;
  lines: InvoiceLine[];
}

type PageState = 'loading' | 'invoice' | 'paying' | 'success' | 'error';

export function PublicInvoicePage() {
  const { token } = useParams<{ token: string }>();
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [state, setState] = useState<PageState>('loading');
  const [error, setError] = useState('');
  const [paidAmount, setPaidAmount] = useState('');

  useEffect(() => {
    if (!token) return;
    fetchInvoice(token);
    // Fire-and-forget: mark as viewed
    fetch(`/api/v1/public/invoices/${token}/viewed`, { method: 'POST' }).catch(() => {});
  }, [token]);

  async function fetchInvoice(t: string) {
    try {
      const res = await fetch(`/api/v1/public/invoices/${t}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: { message: 'Invoice not found' } }));
        setError(data.error?.message || 'Invoice not found');
        setState('error');
        return;
      }
      const data = await res.json();
      setInvoice(data.invoice);
      setState('invoice');
    } catch {
      setError('Unable to load invoice. Please check the link and try again.');
      setState('error');
    }
  }

  function handlePaymentSuccess(amount: string) {
    setPaidAmount(amount);
    setState('success');
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Invoice Not Found</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (state === 'success' && invoice) {
    return <PaymentSuccessView invoice={invoice} paidAmount={paidAmount} />;
  }

  if (!invoice) return null;

  const balanceDue = parseFloat(invoice.balanceDue || invoice.total || '0');
  const isVoid = invoice.invoiceStatus === 'void';
  const isPaid = invoice.invoiceStatus === 'paid' || balanceDue <= 0;
  const canPay = invoice.onlinePaymentsEnabled && invoice.stripePublishableKey && !isVoid && !isPaid && balanceDue > 0;

  const formatMoney = (val: string | null) => {
    if (!val) return '$0.00';
    return `$${parseFloat(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const addr = invoice.companyAddress;
  const addressLine = [addr.city, addr.state].filter(Boolean).join(', ') + (addr.zip ? ` ${addr.zip}` : '');

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Company Header */}
        <div className="bg-white rounded-t-lg border border-gray-200 px-8 py-6">
          <div className="flex items-start justify-between">
            <div>
              {invoice.companyLogoUrl && (
                <img src={invoice.companyLogoUrl} alt={invoice.companyName} className="h-12 mb-2" />
              )}
              <h1 className="text-xl font-bold text-gray-900">{invoice.companyName}</h1>
              {addr.line1 && <p className="text-sm text-gray-600">{addr.line1}</p>}
              {addr.line2 && <p className="text-sm text-gray-600">{addr.line2}</p>}
              {addressLine && <p className="text-sm text-gray-600">{addressLine}</p>}
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-gray-400">INVOICE</h2>
              <p className="text-lg font-mono text-gray-900 mt-1">{invoice.txnNumber}</p>
            </div>
          </div>
        </div>

        {/* Invoice Details */}
        <div className="bg-white border-x border-gray-200 px-8 py-4">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Bill To</p>
              <p className="text-sm font-medium text-gray-900 mt-1">{invoice.customerName || 'Customer'}</p>
              {invoice.customerEmail && <p className="text-sm text-gray-600">{invoice.customerEmail}</p>}
            </div>
            <div className="text-right">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Date:</span>
                  <span className="text-gray-900">{invoice.txnDate}</span>
                </div>
                {invoice.dueDate && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Due Date:</span>
                    <span className="text-gray-900">{invoice.dueDate}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status:</span>
                  <span className={`font-medium ${
                    isVoid ? 'text-red-600' : isPaid ? 'text-green-600' :
                    invoice.invoiceStatus === 'partial' ? 'text-yellow-600' : 'text-blue-600'
                  }`}>
                    {isVoid ? 'Void' : isPaid ? 'Paid' :
                     invoice.invoiceStatus === 'partial' ? 'Partially Paid' : 'Due'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white border-x border-gray-200 px-8 py-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2">Description</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase py-2 w-20">Qty</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase py-2 w-24">Rate</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase py-2 w-28">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2 text-sm text-gray-900">{line.description}</td>
                  <td className="py-2 text-sm text-gray-600 text-right">{line.quantity || ''}</td>
                  <td className="py-2 text-sm text-gray-600 text-right">{line.unitPrice ? formatMoney(line.unitPrice) : ''}</td>
                  <td className="py-2 text-sm text-gray-900 text-right font-mono">{formatMoney(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="bg-white border-x border-gray-200 px-8 py-4">
          <div className="flex justify-end">
            <div className="w-64 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal:</span>
                <span className="text-gray-900 font-mono">{formatMoney(invoice.subtotal)}</span>
              </div>
              {parseFloat(invoice.taxAmount || '0') > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tax:</span>
                  <span className="text-gray-900 font-mono">{formatMoney(invoice.taxAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-medium border-t border-gray-200 pt-1">
                <span className="text-gray-700">Total:</span>
                <span className="text-gray-900 font-mono">{formatMoney(invoice.total)}</span>
              </div>
              {parseFloat(invoice.amountPaid || '0') > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Amount Paid:</span>
                  <span className="font-mono">-{formatMoney(invoice.amountPaid)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t border-gray-300 pt-2">
                <span className="text-gray-900">Balance Due:</span>
                <span className="text-gray-900 font-mono">{formatMoney(invoice.balanceDue)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Memo */}
        {invoice.memo && (
          <div className="bg-white border-x border-gray-200 px-8 py-3">
            <p className="text-xs font-medium text-gray-500 uppercase mb-1">Notes</p>
            <p className="text-sm text-gray-600">{invoice.memo}</p>
          </div>
        )}

        {/* Void Banner */}
        {isVoid && (
          <div className="bg-red-50 border-x border-gray-200 px-8 py-4">
            <p className="text-red-700 font-medium text-center">This invoice has been voided and is no longer payable.</p>
          </div>
        )}

        {/* Paid Banner */}
        {isPaid && !isVoid && (
          <div className="bg-green-50 border-x border-gray-200 px-8 py-4 text-center">
            <p className="text-green-700 font-medium">This invoice has been paid in full. Thank you!</p>
          </div>
        )}

        {/* Payment Section */}
        {canPay && state === 'invoice' && (
          <div className="bg-white border-x border-b border-gray-200 rounded-b-lg px-8 py-6">
            <StripePaymentForm
              token={token!}
              publishableKey={invoice.stripePublishableKey!}
              balanceDue={balanceDue}
              currency={invoice.currency || 'usd'}
              invoiceNumber={invoice.txnNumber || ''}
              onSuccess={handlePaymentSuccess}
            />
          </div>
        )}

        {/* PDF Download */}
        {!canPay && (
          <div className="bg-white border-x border-b border-gray-200 rounded-b-lg px-8 py-4 text-center">
            <a
              href={`/api/v1/public/invoices/${token}?format=pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Download PDF
            </a>
          </div>
        )}

        {canPay && (
          <div className="text-center mt-3">
            <a
              href={`/api/v1/public/invoices/${token}?format=pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 text-sm"
            >
              Download PDF
            </a>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by Vibe MyBooks
        </p>
      </div>
    </div>
  );
}
