import { useState, useMemo, FormEvent } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

interface Props {
  token: string;
  publishableKey: string;
  balanceDue: number;
  currency: string;
  invoiceNumber: string;
  onSuccess: (amount: string) => void;
}

export function StripePaymentForm({ token, publishableKey, balanceDue, currency, invoiceNumber, onSuccess }: Props) {
  const [amount, setAmount] = useState(balanceDue.toFixed(2));
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  // loadStripe must be called only once per publishableKey — memoize it
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);

  async function handleCreateIntent() {
    setError('');
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0.50) {
      setError('Minimum payment is $0.50');
      return;
    }
    if (numAmount > balanceDue + 0.01) {
      setError(`Amount cannot exceed balance due ($${balanceDue.toFixed(2)})`);
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`/api/v1/public/invoices/${token}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: numAmount.toFixed(2) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Failed to create payment');
        return;
      }
      setClientSecret(data.clientSecret);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  if (!clientSecret) {
    // Step 1: Amount selection
    return (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pay Invoice {invoiceNumber}</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            <input
              type="number"
              step="0.01"
              min="0.50"
              max={balanceDue}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md text-lg font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Balance due: ${balanceDue.toFixed(2)}</p>
        </div>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button
          onClick={handleCreateIntent}
          disabled={creating}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {creating ? 'Processing...' : 'Continue to Payment'}
        </button>
      </div>
    );
  }

  // Step 2: Stripe Elements payment form
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
      <CheckoutForm amount={amount} onSuccess={onSuccess} />
    </Elements>
  );
}

function CheckoutForm({ amount, onSuccess }: { amount: string; onSuccess: (amount: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError('');

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href, // fallback redirect
      },
      redirect: 'if_required',
    });

    if (result.error) {
      setError(result.error.message || 'Payment failed');
      setProcessing(false);
    } else if (result.paymentIntent?.status === 'succeeded') {
      onSuccess(amount);
    } else {
      // Handle other statuses (processing, requires_action, etc.)
      setError('Payment is being processed. Please wait.');
      setProcessing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Payment: ${parseFloat(amount).toFixed(2)}
      </h3>
      <PaymentElement className="mb-4" />
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {processing ? 'Processing...' : `Pay $${parseFloat(amount).toFixed(2)}`}
      </button>
      <p className="text-xs text-gray-400 text-center mt-3">
        Payments are processed securely by Stripe.
      </p>
    </form>
  );
}
