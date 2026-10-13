// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Standalone (non-grid) SearchableDropdown: choosing an option with Enter
// moves focus to the next logical field instead of dropping it.

import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchableDropdown } from './SearchableDropdown';

const OPTIONS = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Bravo' },
];

function Dd(props: { onAdvance?: () => boolean | void; onNavigate?: (d: 'next' | 'prev') => void }) {
  const [v, setV] = useState('');
  return <SearchableDropdown value={v} onChange={setV} options={OPTIONS} placeholder="pick" {...props} />;
}

describe('SearchableDropdown standalone Enter navigation', () => {
  it('Enter-select focuses the next field in DOM order (skipping disabled / tabIndex=-1)', async () => {
    const user = userEvent.setup();
    render(
      <form>
        <Dd />
        <input aria-label="disabled" disabled />
        <button type="button" tabIndex={-1}>skip me</button>
        <input aria-label="amount" defaultValue="12.00" />
      </form>,
    );
    await user.click(screen.getByPlaceholderText('pick'));
    await user.keyboard('brav{Enter}');
    const amount = screen.getByLabelText('amount') as HTMLInputElement;
    expect(document.activeElement).toBe(amount);
    // Text is selected so typing replaces it.
    expect(amount.selectionStart).toBe(0);
    expect(amount.selectionEnd).toBe(5);
    expect((screen.getByPlaceholderText('pick') as HTMLInputElement).value).toBe('Bravo');
  });

  it('Enter-select does not submit the form', async () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const user = userEvent.setup();
    render(<form onSubmit={onSubmit}><Dd /><input aria-label="next" /><button type="submit">Save</button></form>);
    await user.click(screen.getByPlaceholderText('pick'));
    await user.keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText('next'));
  });

  it('onAdvance overrides DOM order when it returns true', async () => {
    const user = userEvent.setup();
    render(
      <form>
        <Dd onAdvance={() => { (document.querySelector('[aria-label="debit"]') as HTMLElement).focus(); return true; }} />
        <input aria-label="description" />
        <input aria-label="debit" />
      </form>,
    );
    await user.click(screen.getByPlaceholderText('pick'));
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(screen.getByLabelText('debit'));
  });

  it('a mouse pick keeps the original blur behavior', async () => {
    const user = userEvent.setup();
    render(<form><Dd /><input aria-label="next" /></form>);
    await user.click(screen.getByPlaceholderText('pick'));
    await user.click(screen.getByText('Alpha'));
    expect(document.activeElement).not.toBe(screen.getByPlaceholderText('pick'));
    expect(document.activeElement).not.toBe(screen.getByLabelText('next'));
  });

  it('grid mode still routes through onNavigate', () => {
    const onNavigate = vi.fn();
    render(<form><Dd onNavigate={onNavigate} /><input aria-label="next" /></form>);
    const input = screen.getByPlaceholderText('pick');
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onNavigate).toHaveBeenCalledWith('next');
    expect(document.activeElement).not.toBe(screen.getByLabelText('next'));
  });

  it('Tab keeps native behavior in standalone mode (no selection, no override)', () => {
    render(<form><Dd /><input aria-label="next" /></form>);
    const input = screen.getByPlaceholderText('pick');
    fireEvent.focus(input);
    const ev = fireEvent.keyDown(input, { key: 'Tab' });
    expect(ev).toBe(true); // not default-prevented
  });
});
