import { useParams, useNavigate } from 'react-router-dom';
import { useContact, useDeactivateContact, useContactTransactions } from '../../api/hooks/useContacts';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { Mail, Phone, MapPin, Edit, UserX } from 'lucide-react';

export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useContact(id!);
  const { data: txnData } = useContactTransactions(id!);
  const deactivateContact = useDeactivateContact();

  if (isLoading) return <LoadingSpinner className="py-12" />;
  if (isError || !data) return <ErrorMessage onRetry={() => refetch()} />;

  const contact = data.contact;

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
    </div>
  );
}
