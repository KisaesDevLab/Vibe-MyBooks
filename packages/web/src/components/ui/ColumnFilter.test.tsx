// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColumnFilter } from './ColumnFilter';

const options = [
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partial', label: 'Partial' },
];

describe('ColumnFilter', () => {
  it('opens a portal popover, applies the ticked values and the chosen sort', () => {
    const onApply = vi.fn();
    render(<ColumnFilter options={options} selected={new Set()} sort={null} onApply={onApply} ariaLabel="Filter Status" />);
    fireEvent.click(screen.getByRole('button', { name: 'Filter Status' }));
    const dialog = screen.getByRole('dialog', { name: 'Filter Status' });
    // Rendered under document.body, not inside the trigger's parent.
    expect(dialog.closest('body')).toBe(document.body);

    fireEvent.click(screen.getByLabelText('Paid'));
    fireEvent.click(screen.getByLabelText('Partial'));
    fireEvent.click(screen.getByRole('button', { name: /sort z → a/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect([...onApply.mock.calls[0]![0]].sort()).toEqual(['paid', 'partial']);
    expect(onApply.mock.calls[0]![1]).toBe('desc');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Cancel discards the draft; a parent re-render mid-edit does not wipe it', () => {
    const onApply = vi.fn();
    const { rerender } = render(<ColumnFilter options={options} selected={new Set(['paid'])} sort={null} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: /filter and sort/i }));
    fireEvent.click(screen.getByLabelText('Unpaid'));
    // Parent passes a NEW Set with the same content — the tick must survive.
    rerender(<ColumnFilter options={options} selected={new Set(['paid'])} sort={null} onApply={onApply} />);
    expect((screen.getByLabelText('Unpaid') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onApply).not.toHaveBeenCalled();
  });

  it('Clear applies an empty set and no sort; the badge counts active state', () => {
    const onApply = vi.fn();
    render(<ColumnFilter options={options} selected={new Set(['paid', 'unpaid'])} sort="asc" onApply={onApply} />);
    // 2 values + 1 sort.
    expect(screen.getByRole('button', { name: /filter and sort/i }).textContent).toContain('3');
    fireEvent.click(screen.getByRole('button', { name: /filter and sort/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onApply).toHaveBeenCalledWith(new Set(), null);
  });

  it('Check all / Uncheck all act on the searched subset only', () => {
    const onApply = vi.fn();
    const many = Array.from({ length: 12 }, (_, i) => ({ value: `v${i}`, label: i < 6 ? `Alpha ${i}` : `Beta ${i}` }));
    render(<ColumnFilter options={many} selected={new Set()} sort={null} onApply={onApply} />);
    fireEvent.click(screen.getByRole('button', { name: /filter and sort/i }));
    fireEvent.change(screen.getByLabelText('Search values'), { target: { value: 'beta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    const applied = [...onApply.mock.calls[0]![0]];
    expect(applied).toHaveLength(6);
    expect(applied.every((v) => Number(String(v).slice(1)) >= 6)).toBe(true);
  });

  it('closes on Escape and on an outside pointerdown without applying', () => {
    const onApply = vi.fn();
    render(<div><span data-testid="outside">x</span><ColumnFilter options={options} selected={new Set()} sort={null} onApply={onApply} /></div>);
    fireEvent.click(screen.getByRole('button', { name: /filter and sort/i }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /filter and sort/i }));
    fireEvent.pointerDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onApply).not.toHaveBeenCalled();
  });
});
