// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.
//
// Shared behaviour for calculator-style numeric fields (MoneyInput and
// NumericInput). The field is a text input so people can type math —
// "145.15-50", "200*15%", "(1200+300)/12" — which is evaluated with the
// shared safe parser (no eval) when they press Enter, Tab or leave it.
//
// Value contract for callers is unchanged from the old type="number"
// inputs: onChange only ever receives a plain number string ("95.15") or
// ''. Plain numbers typed key-by-key still flow through live (so running
// totals update as before); an expression is held as a local draft and
// only committed once evaluated. Garbage is never committed.

import {
  useCallback, useEffect, useId, useLayoutEffect, useRef, useState,
  type ChangeEvent, type FocusEvent, type KeyboardEvent, type Ref, type RefObject,
} from 'react';
import { createPortal, flushSync } from 'react-dom';
import { evaluateExpression, isPlainNumberText } from '@kis-books/shared';

export const CALC_HINT = 'You can type math, e.g. 145.15-50';

export interface CalcOptions {
  /** Round evaluated results to this many places (half away from zero). */
  decimals?: number;
  /** Pad evaluated results to exactly `decimals` places (money: "30.00"). */
  padDecimals?: boolean;
  min?: number;
  max?: number;
  /** Allow results below zero. Defaults to false when min >= 0. */
  allowNegative?: boolean;
  /** Only whole numbers are accepted. */
  integer?: boolean;
  /** Wording for the negative-value error ("Amount can't be negative here"). */
  negativeMessage?: string;
}

interface UseCalcInputArgs extends CalcOptions {
  value: string;
  onChange: (value: string) => void;
  forwardedRef?: Ref<HTMLInputElement>;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}

type Validation = { ok: true; text: string } | { ok: false; error: string };

function fmtLimit(n: number): string {
  return String(n);
}

/** Evaluate + validate `text` against the field's options. */
export function validateCalcText(text: string, opts: CalcOptions): Validation {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: true, text: '' };
  const r = evaluateExpression(trimmed);
  if (!r.ok) return { ok: false, error: r.error };
  const allowNegative = opts.allowNegative ?? !(opts.min !== undefined && opts.min >= 0);
  if (r.value < 0 && !allowNegative) {
    return { ok: false, error: opts.negativeMessage ?? "Can't be negative here" };
  }
  if (opts.integer && !r.isInteger) return { ok: false, error: 'Must be a whole number' };
  if (opts.min !== undefined && r.value < opts.min) return { ok: false, error: `Must be at least ${fmtLimit(opts.min)}` };
  if (opts.max !== undefined && r.value > opts.max) return { ok: false, error: `Must be at most ${fmtLimit(opts.max)}` };
  // A plain number the user typed is kept verbatim (the old number-input
  // contract); only real expressions are normalised.
  if (isPlainNumberText(trimmed)) return { ok: true, text: trimmed };
  let out = r.format(opts.integer ? 0 : opts.decimals);
  if (opts.decimals !== undefined && !opts.padDecimals && out.includes('.')) out = out.replace(/\.?0+$/, '');
  return { ok: true, text: out };
}

function hasOperator(text: string): boolean {
  return !isPlainNumberText(text);
}

export function useCalcInput(args: UseCalcInputArgs) {
  const { value, onChange, forwardedRef, onBlur, onFocus, onKeyDown, ...opts } = args;
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const msgId = useId();

  const setRefs = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
    if (typeof forwardedRef === 'function') forwardedRef(el);
    else if (forwardedRef) (forwardedRef as { current: HTMLInputElement | null }).current = el;
  }, [forwardedRef]);

  // Outside changes (form reset, template fill, another field's math)
  // replace a stale draft unless the user is mid-edit in this field.
  const lastValue = useRef(value);
  useEffect(() => {
    if (lastValue.current === value) return;
    lastValue.current = value;
    if (document.activeElement !== inputRef.current) {
      setDraft(null);
      setError(null);
    }
  }, [value]);

  // Native form validation blocks a submit while the field holds an
  // expression that couldn't be committed.
  useEffect(() => {
    inputRef.current?.setCustomValidity(error ?? '');
  }, [error]);

  const text = draft ?? (value ?? '');

  /** Evaluate the draft and hand the plain number to the caller. Returns false when it can't. */
  // Latest caller props, refreshed every render. A caller that saves in
  // its own onBlur (`onBlur={() => save(draftState)}`) must see the value
  // this blur just committed, so commit flushes the caller's state update
  // synchronously and onBlur is then read from the re-rendered props.
  const latest = useRef({ onBlur });
  latest.current = { onBlur };

  const commit = (sync = false): boolean => {
    if (draft === null) return true;
    const v = validateCalcText(draft, opts);
    if (!v.ok) { setError(v.error); return false; }
    const apply = () => {
      setError(null);
      setDraft(null);
      if (v.text !== value) onChange(v.text);
    };
    if (sync && v.text !== value) flushSync(apply);
    else apply();
    return true;
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const t = e.target.value;
    setDraft(t);
    if (!hasOperator(t)) {
      // Plain number typed key by key: pass it straight through like the
      // old number input did, unless it's a sign the field refuses.
      const v = validateCalcText(t, opts);
      if (t.trim() === '' || t.trim() === '-' || t.trim() === '.' || t.trim() === '-.') {
        setError(null);
        if (t.trim() === '' && value !== '') onChange('');
        return;
      }
      if (v.ok) {
        setError(null);
        if (v.text !== value) onChange(v.text);
      } else if (/negative/i.test(v.error)) {
        setError(v.error);
      } else {
        // Min/max/whole-number problems surface on commit, as before.
        setError(null);
        if (t !== value) onChange(t.trim());
      }
    } else if (error) {
      setError(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey && draft !== null) {
      const needsEval = hasOperator(draft) || error !== null;
      if (needsEval) {
        // Enter evaluates; it never submits / saves / adds a row from a
        // field that still holds an expression. A second Enter (now a
        // plain number) behaves as it always has.
        e.preventDefault();
        e.stopPropagation();
        commit();
        return;
      }
    }
    if (e.key === 'Escape' && draft !== null && hasOperator(draft)) {
      e.preventDefault();
      e.stopPropagation();
      setDraft(null);
      setError(null);
      return;
    }
    onKeyDown?.(e);
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    // An expression that can't be evaluated stays in the field (red, with
    // its message) and the caller's onBlur is skipped, so an onBlur-save
    // can't persist the stale value behind it.
    if (!commit(true)) return;
    latest.current.onBlur?.(e);
  };

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    onFocus?.(e);
  };

  let preview: string | null = null;
  if (draft !== null && hasOperator(draft) && !error) {
    const v = validateCalcText(draft, opts);
    preview = v.ok ? `= ${v.text}` : null;
  }

  return {
    inputRef,
    setRefs,
    text,
    error,
    preview,
    focused,
    msgId,
    commit,
    handlers: { onChange: handleChange, onKeyDown: handleKeyDown, onBlur: handleBlur, onFocus: handleFocus },
  };
}

/**
 * Small floating "= 95.15" / error bubble under a calc field. Portalled
 * with fixed positioning so it never shifts the caller's layout (grids,
 * inline "every [3] days" inputs) and is never clipped by overflow.
 */
export function CalcBubble({ anchor, id, preview, error, visible }: {
  anchor: RefObject<HTMLInputElement | null>;
  id: string;
  preview: string | null;
  error: string | null;
  visible: boolean;
}) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const message = error ?? preview;
  const show = visible && !!message;

  useLayoutEffect(() => {
    if (!show) return;
    const update = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (r) setPos({ left: r.right, top: r.bottom + 2 });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [show, anchor]);

  if (!show) return null;
  return createPortal(
    <div
      id={id}
      role={error ? 'alert' : 'status'}
      className={
        'pointer-events-none fixed z-[1100] -translate-x-full whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-mono shadow ' +
        (error ? 'bg-red-600 text-white' : 'bg-gray-800 text-white')
      }
      style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
    >
      {message}
    </div>,
    document.body,
  );
}
