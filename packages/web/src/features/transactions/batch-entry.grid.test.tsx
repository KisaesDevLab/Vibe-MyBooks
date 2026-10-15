// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Batch Entry grid: Tab walks EVERY column including the Payee / Account
// dropdowns, a row's date defaults to the previous row's, and a row holding
// only that inherited date is not sent to the server.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BatchEntryPage } from './BatchEntryPage';

const validateMutate = vi.fn();
vi.mock('../../api/hooks/useBatch', () => ({
  useValidateBatch: () => ({ mutate: validateMutate, isPending: false, error: null }),
  useSaveBatch: () => ({ mutate: vi.fn(), isPending: false, error: null }),
  useParseCsv: () => ({ mutate: vi.fn() }),
  useSuggestAccountForContact: () => ({ mutate: vi.fn() }),
}));
vi.mock('../../api/hooks/useAccounts', () => ({ useAccounts: () => ({ data: { data: [] } }) }));
vi.mock('../../api/hooks/useContacts', () => ({ useContacts: () => ({ data: { data: [] } }) }));
// Stand-in pickers that honour the same grid contract as the real ones
// (data-cell stamp + Tab routed through onNavigate).
function Picker({ dataCell, onNavigate, placeholder }: { dataCell?: string; onNavigate?: (d: 'next' | 'prev') => void; placeholder: string }) {
  return (
    <input
      placeholder={placeholder}
      data-cell={dataCell}
      onKeyDown={(e) => { if (e.key === 'Tab' && onNavigate) { e.preventDefault(); onNavigate(e.shiftKey ? 'prev' : 'next'); } }}
    />
  );
}
vi.mock('../../components/forms/AccountSelector', () => ({
  AccountSelector: (p: { dataCell?: string; onNavigate?: (d: 'next' | 'prev') => void }) => <Picker {...p} placeholder="account" />,
}));
vi.mock('../../components/forms/ContactSelector', () => ({
  ContactSelector: (p: { dataCell?: string; onNavigate?: (d: 'next' | 'prev') => void }) => <Picker {...p} placeholder="contact" />,
}));
vi.mock('../../components/forms/SplitRowV2/LineTagPicker', () => ({ LineTagPicker: () => null }));

// moveFocus defers a frame; run rAF synchronously.
beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { cb(0); return 0; });
  validateMutate.mockClear();
  try { window.localStorage.clear(); } catch { /* noop */ }
});

const cell = (r: number, c: number) => document.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`)!;

describe('Batch Entry grid', () => {
  it('Tab visits date → ref → payee dropdown → account dropdown → memo → amount, then wraps', () => {
    render(<BatchEntryPage />);
    act(() => { cell(0, 0).focus(); });
    const order: Array<string | null> = [];
    for (let i = 0; i < 6; i++) {
      fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
      order.push((document.activeElement as HTMLElement).getAttribute('data-cell'));
    }
    expect(order).toEqual(['0-1', '0-2', '0-3', '0-4', '0-5', '1-0']);
  });

  it('defaults a row date to the previous row and ignores date-only rows', () => {
    render(<BatchEntryPage />);
    // Bills: no bank account needed, so Validate is enabled.
    // Columns: date, vendor inv #, vendor, due date, account, description, amount.
    fireEvent.change(screen.getByLabelText('Transaction type'), { target: { value: 'bill' } });
    fireEvent.change(cell(0, 0), { target: { value: '2026-10-05' } });
    fireEvent.change(cell(0, 6), { target: { value: '12.50' } });
    // Entering row 2's date cell inherits row 1's date.
    act(() => { cell(1, 0).focus(); });
    expect((cell(1, 0) as HTMLInputElement).value).toBe('2026-10-05');
    // Typing in row 3 (no date yet) also inherits it.
    fireEvent.change(cell(2, 5), { target: { value: 'lunch' } });
    expect((cell(2, 0) as HTMLInputElement).value).toBe('2026-10-05');

    fireEvent.click(screen.getByRole('button', { name: /validate/i }));
    const sent = validateMutate.mock.calls[0]![0] as { rows: Array<{ rowNumber: number }> };
    // Row 2 has only the inherited date — not sent.
    expect(sent.rows.map((r) => r.rowNumber)).toEqual([1, 3]);
  });
});
