// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { type InputHTMLAttributes, forwardRef } from 'react';
import { useCalcInput, CalcBubble, CALC_HINT } from './useCalcInput';

export interface NumericInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value' | 'min' | 'max' | 'step'> {
  value: string | number | null | undefined;
  /** Receives a plain number string ("95.15") or '' — never an expression. */
  onChange: (value: string) => void;
  /** Round evaluated math to this many places (typed plain numbers are kept as typed). */
  decimals?: number;
  /** Pad evaluated math to exactly `decimals` places (money: "30.00"). */
  padDecimals?: boolean;
  min?: number;
  max?: number;
  /** Accepted for parity with the old number input; has no effect on a text field. */
  step?: number | string;
  /** Allow results below zero. Defaults to false when `min` >= 0, true otherwise. */
  allowNegative?: boolean;
  /** Whole numbers only (counts, days, months …). */
  integer?: boolean;
}

/**
 * Drop-in replacement for `<input type="number">` that also accepts
 * calculator math ("1200/12", "40*1.5", "8.25%*100"). It renders a bare
 * <input> (no wrapper) so it keeps the caller's className / layout; the
 * "= result" preview and errors float below it while focused, and an
 * invalid entry keeps a red border + tooltip after the field is left.
 */
export const NumericInput = forwardRef<HTMLInputElement, NumericInputProps>(function NumericInput(
  { value, onChange, decimals, padDecimals, min, max, step: _step, allowNegative, integer, onBlur, onFocus, onKeyDown, title, style, ...rest },
  ref,
) {
  const calc = useCalcInput({
    value: value === null || value === undefined ? '' : String(value),
    onChange, forwardedRef: ref, onBlur, onFocus, onKeyDown,
    decimals, padDecimals, min, max, allowNegative, integer,
  });
  const negOk = allowNegative ?? !(min !== undefined && min >= 0);
  const bubbleVisible = calc.focused && !!(calc.preview || calc.error);
  return (
    <>
      <input
        {...rest}
        ref={calc.setRefs}
        type="text"
        inputMode={negOk ? undefined : integer ? 'numeric' : 'decimal'}
        autoComplete="off"
        title={calc.error ?? title ?? CALC_HINT}
        aria-invalid={calc.error ? true : rest['aria-invalid']}
        aria-describedby={bubbleVisible ? calc.msgId : rest['aria-describedby']}
        style={calc.error ? { ...style, borderColor: '#f87171' } : style}
        value={calc.text}
        {...calc.handlers}
      />
      <CalcBubble anchor={calc.inputRef} id={calc.msgId} preview={calc.preview} error={calc.error} visible={bubbleVisible} />
    </>
  );
});
