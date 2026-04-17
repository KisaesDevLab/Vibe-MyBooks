// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { type InputHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';

interface DatePickerProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1">
        {label && <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">{label}</label>}
        <input
          ref={ref}
          id={inputId}
          type="date"
          className={clsx(
            'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            error ? 'border-red-300' : 'border-gray-300',
            className,
          )}
          {...props}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  },
);
DatePicker.displayName = 'DatePicker';
