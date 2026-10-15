// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

import { STATE_CODES, STATE_NAMES, type StateCode } from '@kis-books/shared';
import { SELECT_CLASS } from './labels';

/**
 * QA D3: a state is chosen from the 51 jurisdictions the module has rules for
 * (50 states + DC). Never a free-text box: a two-character limit once turned
 * "Missouri" into "MI" and saved it silently.
 */
/**
 * QA2-08: options read "Missouri (MO)" in name order, so the browser's keyboard type-ahead
 * (which matches the start of the option text) lands on Missouri when the name is typed,
 * not on "MI · Michigan" after the first two letters.
 */
const BY_NAME: ReadonlyArray<StateCode> = [...STATE_CODES].sort((a, b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b]));

export function StateSelect({ id, label, value, onChange, disabled, emptyLabel = 'Not set', allowEmpty = true, ariaLabel }: {
  id: string; label?: string; value: string; onChange: (code: StateCode | '') => void;
  disabled?: boolean; emptyLabel?: string; allowEmpty?: boolean; ariaLabel?: string;
}) {
  const known = value === '' || (STATE_CODES as readonly string[]).includes(value);
  return (
    <div className="space-y-1">
      {label && <label htmlFor={id} className="block text-sm font-medium text-gray-700">{label}</label>}
      <select id={id} aria-label={ariaLabel} className={`${SELECT_CLASS} disabled:bg-gray-50 disabled:text-gray-500`} value={value} disabled={disabled}
        onChange={(e) => onChange(e.target.value as StateCode | '')}>
        {(allowEmpty || value === '') && <option value="">{allowEmpty ? emptyLabel : 'Choose a state'}</option>}
        {!known && <option value={value}>{value} (not a supported state)</option>}
        {BY_NAME.map((c) => <option key={c} value={c}>{STATE_NAMES[c]} ({c})</option>)}
      </select>
    </div>
  );
}
