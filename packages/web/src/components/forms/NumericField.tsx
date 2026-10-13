// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { forwardRef } from 'react';
import clsx from 'clsx';
import { NumericInput, type NumericInputProps } from './NumericInput';

interface NumericFieldProps extends NumericInputProps {
  label?: string;
  error?: string;
}

/**
 * The labelled `<Input>` look (components/ui/Input) around a calculator
 * NumericInput — the replacement for `<Input type="number" … />` and for
 * `<Input inputMode="decimal" … />` amount / rate fields.
 */
export const NumericField = forwardRef<HTMLInputElement, NumericFieldProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <NumericInput
          ref={ref}
          id={inputId}
          className={clsx(
            'block w-full rounded-lg border px-3 py-2 text-sm shadow-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            error
              ? 'border-red-300 text-red-900 placeholder-red-300'
              : 'border-gray-300 text-gray-900 placeholder-gray-400',
            className,
          )}
          aria-invalid={error ? true : undefined}
          {...props}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  },
);
NumericField.displayName = 'NumericField';
