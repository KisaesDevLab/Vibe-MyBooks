interface Props {
  invoice: {
    txnNumber: string | null;
    companyName: string;
    customerEmail: string | null;
    balanceDue: string | null;
  };
  paidAmount: string;
}

export function PaymentSuccessView({ invoice, paidAmount }: Props) {
  const remaining = parseFloat(invoice.balanceDue || '0') - parseFloat(paidAmount);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Payment Received</h2>
        <p className="text-2xl font-bold text-green-600 mb-4">
          ${parseFloat(paidAmount).toFixed(2)}
        </p>
        <p className="text-gray-600 text-sm mb-2">
          Payment for invoice {invoice.txnNumber} to {invoice.companyName}.
        </p>
        {invoice.customerEmail && (
          <p className="text-gray-500 text-sm mb-4">
            A confirmation has been sent to {invoice.customerEmail}.
          </p>
        )}
        {remaining > 0.01 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
            Remaining balance: ${remaining.toFixed(2)}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-6">Powered by Vibe MyBooks</p>
      </div>
    </div>
  );
}
