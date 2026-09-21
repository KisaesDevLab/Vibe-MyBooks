// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentMethod } from '@kis-books/shared';

interface PaymentMethodSelectProps {
  label?: string;
  value: PaymentMethod | '';
  onChange: (value: PaymentMethod | '') => void;
}

// How a customer paid. Optional everywhere it appears — blank is stored as
// "not recorded", never guessed.
export function PaymentMethodSelect({ label = 'Payment Method', value, onChange }: PaymentMethodSelectProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as PaymentMethod | '')}
        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">—</option>
        {PAYMENT_METHODS.map((m) => (
          <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
        ))}
      </select>
    </div>
  );
}
