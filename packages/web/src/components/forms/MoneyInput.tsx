// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { type InputHTMLAttributes, forwardRef } from 'react';
import clsx from 'clsx';
import { useCalcInput, CalcBubble, CALC_HINT } from './useCalcInput';

interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value' | 'min' | 'max'> {
  label?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  /** Accept amounts below zero (e.g. a statement balance). Off by default:
   *  debit / credit / payment fields only take positive amounts. */
  allowNegative?: boolean;
  min?: number;
  max?: number;
}

/**
 * Dollar amount field with a built-in calculator: "145.15-50" + Enter
 * (or Tab / leaving the field) becomes 95.15. onChange only ever receives
 * a plain number string (or ''), exactly like the old number input.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ label, error, value, onChange, className, id, allowNegative, min, max, onBlur, onFocus, onKeyDown, title, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    const calc = useCalcInput({
      value, onChange, forwardedRef: ref, onBlur, onFocus, onKeyDown,
      decimals: 2, padDecimals: true, allowNegative: allowNegative ?? false,
      min: min ?? (allowNegative ? undefined : 0), max,
      negativeMessage: "Amount can't be negative here",
    });
    const shownError = error || (!calc.focused ? calc.error : null);
    const bubbleVisible = calc.focused && !!(calc.preview || calc.error);

    return (
      <div className="space-y-1">
        {label && <label htmlFor={inputId} className="block text-sm font-medium text-gray-700">{label}</label>}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
          <input
            ref={calc.setRefs}
            id={inputId}
            type="text"
            inputMode={allowNegative ? undefined : 'decimal'}
            autoComplete="off"
            title={calc.error ?? title ?? CALC_HINT}
            aria-invalid={calc.error || error ? true : undefined}
            aria-describedby={bubbleVisible ? calc.msgId : undefined}
            value={calc.text}
            {...calc.handlers}
            className={clsx(
              'block w-full rounded-lg border px-3 py-2 pl-7 text-sm text-right font-mono shadow-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
              error || calc.error ? 'border-red-400' : 'border-gray-300',
              className,
            )}
            {...props}
          />
        </div>
        <CalcBubble anchor={calc.inputRef} id={calc.msgId} preview={calc.preview} error={calc.error} visible={bubbleVisible} />
        {shownError && <p className="text-sm text-red-600">{shownError}</p>}
      </div>
    );
  },
);
MoneyInput.displayName = 'MoneyInput';
