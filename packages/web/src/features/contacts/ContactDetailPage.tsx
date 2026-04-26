// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useContact, useDeactivateContact, useContactTransactions } from '../../api/hooks/useContacts';
import { useBills, useVendorCredits } from '../../api/hooks/useAp';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Mail, Phone, MapPin, Edit, UserX, Receipt, Banknote, RotateCcw, FileText } from 'lucide-react';

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useContact(id!);
  const { data: txnData } = useContactTransactions(id!);
  const deactivateContact = useDeactivateContact();

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError || !data) return <ErrorMessage onRetry={() => refetch()} />;

  const contact = data.contact;
  const isVendor = contact.contactType === 'vendor' || contact.contactType === 'both';

  const handleDeactivate = () => {
    deactivateContact.mutate(contact.id, { onSuccess: () => navigate('/contacts') });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{contact.displayName}</h1>
          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize mt-1">
            {contact.contactType}
          </span>
          {!contact.isActive && (
            <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 ml-2">
              Inactive
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => navigate(`/contacts/${id}/edit`)}>
            <Edit className="h-4 w-4 mr-1" /> Edit
          </Button>
          {contact.isActive && (
            <Button variant="danger" size="sm" onClick={handleDeactivate} loading={deactivateContact.isPending}>
              <UserX className="h-4 w-4 mr-1" /> Deactivate
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info Card */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">Contact Info</h2>
          {contact.companyName && <p className="text-sm text-gray-600">{contact.companyName}</p>}
          {(contact.firstName || contact.lastName) && (
            <p className="text-sm text-gray-600">{[contact.firstName, contact.lastName].filter(Boolean).join(' ')}</p>
          )}
          {contact.email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="h-4 w-4" /> {contact.email}
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="h-4 w-4" /> {contact.phone}
            </div>
          )}
          {contact.billingLine1 && (
            <div className="flex items-start gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4 mt-0.5" />
              <div>
                <p>{contact.billingLine1}</p>
                {contact.billingLine2 && <p>{contact.billingLine2}</p>}
                <p>{[contact.billingCity, contact.billingState, contact.billingZip].filter(Boolean).join(', ')}</p>
              </div>
            </div>
          )}

          {contact.contactType !== 'customer' && (
            <div className="pt-2 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-1">Vendor Details</h3>
              {contact.taxId && <p className="text-sm text-gray-600">Tax ID: {contact.taxId}</p>}
              <p className="text-sm text-gray-600">1099 Eligible: {contact.is1099Eligible ? 'Yes' : 'No'}</p>
              {contact.is1099Eligible && (
                <RequestW9Inline
                  contactId={contact.id}
                  defaultEmail={contact.email ?? ''}
                />
              )}
            </div>
          )}

          {contact.notes && (
            <div className="pt-2 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-1">Notes</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{contact.notes}</p>
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Transaction History</h2>
          {(!txnData || txnData.total === 0) ? (
            <p className="text-sm text-gray-500 text-center py-8">No transactions yet.</p>
          ) : (
            <p className="text-sm text-gray-500">{txnData.total} transactions</p>
          )}
        </div>
      </div>

      {isVendor && <VendorApSection contactId={contact.id} />}
    </div>
  );
}

function VendorApSection({ contactId }: { contactId: string }) {
  const navigate = useNavigate();
  const { data: billsData, isLoading: billsLoading } = useBills({ contactId, limit: 100 });
  const { data: creditsData, isLoading: creditsLoading } = useVendorCredits({ contactId, limit: 50 });

  const bills = billsData?.data || [];
  const credits = creditsData?.data || [];

  // Roll-ups
  const unpaid = bills.filter((b) => b.billStatus !== 'paid' && parseFloat(b.balanceDue || '0') > 0);
  const overdue = unpaid.filter((b) => b.daysOverdue > 0);
  const totalOwed = unpaid.reduce((s, b) => s + parseFloat(b.balanceDue || '0'), 0);
  const totalOverdue = overdue.reduce((s, b) => s + parseFloat(b.balanceDue || '0'), 0);
  const availableCredits = credits.filter((c) => parseFloat(c.balanceDue || '0') > 0);
  const totalAvailableCredits = availableCredits.reduce((s, c) => s + parseFloat(c.balanceDue || '0'), 0);

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Accounts Payable</h2>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => navigate('/bills/new')}>
            <Receipt className="h-4 w-4 mr-1" /> Create Bill
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/vendor-credits/new')}>
            <RotateCcw className="h-4 w-4 mr-1" /> Enter Credit
          </Button>
          <Button size="sm" variant="secondary" onClick={() => navigate('/pay-bills')}>
            <Banknote className="h-4 w-4 mr-1" /> Pay Bills
          </Button>
        </div>
      </div>

      {/* AP Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="text-xs text-gray-500 uppercase">Unpaid Bills</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{unpaid.length}</div>
          <div className="text-sm font-mono text-gray-600">${totalOwed.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="text-xs text-gray-500 uppercase">Overdue</div>
          <div className={`text-2xl font-bold mt-1 ${overdue.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {overdue.length}
          </div>
          <div className={`text-sm font-mono ${overdue.length > 0 ? 'text-red-600' : 'text-gray-600'}`}>
            ${totalOverdue.toFixed(2)}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="text-xs text-gray-500 uppercase">Available Credits</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">{availableCredits.length}</div>
          <div className="text-sm font-mono text-gray-600">${totalAvailableCredits.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="text-xs text-gray-500 uppercase">Net Owed</div>
          <div className="text-2xl font-bold text-gray-900 mt-1">
            ${Math.max(0, totalOwed - totalAvailableCredits).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Bills */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b font-medium text-sm text-gray-700">Bills</div>
        {billsLoading ? (
          <LoadingSpinner className="py-8" />
        ) : bills.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No bills for this vendor.</p>
        ) : (
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2 px-3">Bill #</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2 px-3">Vendor Inv #</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2 px-3">Date</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2 px-3">Due</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2 px-3">Status</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase py-2 px-3">Total</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase py-2 px-3">Balance</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr
                  key={b.id}
                  className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/bills/${b.id}`)}
                >
                  <td className="py-2 px-3 text-sm font-mono">{b.txnNumber}</td>
                  <td className="py-2 px-3 text-sm">{b.vendorInvoiceNumber || '—'}</td>
                  <td className="py-2 px-3 text-sm">{b.txnDate}</td>
                  <td className={`py-2 px-3 text-sm ${b.daysOverdue > 0 ? 'text-red-600' : ''}`}>
                    {b.dueDate || '—'}
                  </td>
                  <td className="py-2 px-3 text-xs uppercase">{b.billStatus}</td>
                  <td className="py-2 px-3 text-sm text-right font-mono">${parseFloat(b.total || '0').toFixed(2)}</td>
                  <td className="py-2 px-3 text-sm text-right font-mono">${parseFloat(b.balanceDue || '0').toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Vendor Credits */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b font-medium text-sm text-gray-700">Vendor Credits</div>
        {creditsLoading ? (
          <LoadingSpinner className="py-8" />
        ) : credits.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">No credits for this vendor.</p>
        ) : (
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2 px-3">Credit #</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2 px-3">Date</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase py-2 px-3">Total</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase py-2 px-3">Available</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2 px-3">Memo</th>
              </tr>
            </thead>
            <tbody>
              {credits.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-2 px-3 text-sm font-mono">{c.txnNumber}</td>
                  <td className="py-2 px-3 text-sm">{c.txnDate}</td>
                  <td className="py-2 px-3 text-sm text-right font-mono">${parseFloat(c.total || '0').toFixed(2)}</td>
                  <td className="py-2 px-3 text-sm text-right font-mono">${parseFloat(c.balanceDue || '0').toFixed(2)}</td>
                  <td className="py-2 px-3 text-sm">{c.memo || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RequestW9Inline({
  contactId,
  defaultEmail,
}: {
  contactId: string;
  defaultEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrMsg(null);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/v1/practice/1099/w9-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({
          contactId,
          email: email.trim(),
          message: message.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || `HTTP ${res.status}`);
      }
      setStatus('sent');
      setOpen(false);
    } catch (err) {
      setStatus('error');
      setErrMsg(err instanceof Error ? err.message : 'Failed to send.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <div className="mt-2">
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <FileText className="h-4 w-4 mr-1" />
          Request W-9
        </Button>
        {status === 'sent' && (
          <p className="mt-1 text-xs text-green-700">W-9 request sent.</p>
        )}
        {status === 'error' && errMsg && (
          <p className="mt-1 text-xs text-red-700">{errMsg}</p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2 p-3 border border-gray-200 rounded-md bg-gray-50">
      <label className="block text-xs">
        <span className="text-gray-700 font-medium">Recipient email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          maxLength={320}
        />
      </label>
      <label className="block text-xs">
        <span className="text-gray-700 font-medium">Message (optional)</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          maxLength={2000}
          className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </label>
      {errMsg && <p className="text-xs text-red-700">{errMsg}</p>}
      <div className="flex items-center gap-2">
        <Button size="sm" type="submit" loading={submitting}>
          Send request
        </Button>
        <Button
          size="sm"
          variant="secondary"
          type="button"
          onClick={() => {
            setOpen(false);
            setStatus('idle');
            setErrMsg(null);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
