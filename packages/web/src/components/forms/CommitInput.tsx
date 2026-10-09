// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { forwardRef, useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { isCompleteDate } from '../../hooks/useDebouncedValue';

type NativeProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'defaultValue'>;

export interface CommitInputProps extends NativeProps {
  value: string;
  /** Called with the new value when the user commits it. */
  onCommit: (value: string) => void;
}

/**
 * A filter input (search text or `type="date"`) that keeps what the user
 * types as a local draft and only hands it to the page — and so only fires
 * the query — when they press Enter or leave the field. Typing a date
 * segment by segment or a search word letter by letter no longer re-runs
 * the list on every keystroke.
 *
 * Two changes commit immediately because nothing more is coming:
 *  - a date picked from the native calendar popup (a change with no
 *    keystroke behind it), and
 *  - clearing the field with the native clear control.
 * Escape reverts the draft to the committed value. A partial date (year
 * "0202") is never committed; leaving the field reverts it.
 */
export const CommitInput = forwardRef<HTMLInputElement, CommitInputProps>(function CommitInput(
  { value, onCommit, onBlur, onKeyDown, type, ...rest },
  ref,
) {
  const [draft, setDraft] = useState(value);
  const lastKeyAt = useRef(0);
  const isDate = type === 'date';

  // Follow outside changes (Clear-filters button, presets, URL params).
  useEffect(() => { setDraft(value); }, [value]);

  const committable = (v: string) => !isDate || v === '' || isCompleteDate(v);

  const commit = (v: string) => {
    if (v === value) return;
    if (committable(v)) onCommit(v);
    else setDraft(value);
  };

  return (
    <input
      {...rest}
      ref={ref}
      type={type}
      value={draft}
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        const fromKeyboard = Date.now() - lastKeyAt.current < 150;
        if ((!fromKeyboard && (isDate || v === '')) && committable(v) && v !== value) onCommit(v);
      }}
      onKeyDown={(e) => {
        lastKeyAt.current = Date.now();
        if (e.key === 'Enter') {
          e.preventDefault();
          commit(draft);
        } else if (e.key === 'Escape') {
          setDraft(value);
        }
        onKeyDown?.(e);
      }}
      onBlur={(e) => {
        commit(draft);
        onBlur?.(e);
      }}
    />
  );
});
