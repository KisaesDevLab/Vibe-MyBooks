// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// The generic report table gets every report sorting and filtering at once:
// money columns sort numerically, text columns offer a value filter, and the
// footer totals follow the rows on screen once a filter narrows them.

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderRoute } from '../../test-utils';
import { ReportTable } from './ReportTable';

const columns = [
  { key: 'vendor', label: 'Vendor' },
  { key: 'amount', label: 'Amount', align: 'right' as const, format: 'money' as const },
];
const data = [
  { vendor: 'Zed', amount: '9.00' },
  { vendor: 'Acme', amount: '1000.00' },
  { vendor: 'Mid', amount: '25.50' },
];

// Body rows only: the first row is the header, the last (when totals are
// given) is the footer.
const vendorsShown = () => screen.getAllByRole('row').slice(1)
  .map((r) => within(r).getAllByRole('cell')[0]!.textContent)
  .filter((t) => t !== 'Total');

beforeEach(() => sessionStorage.clear());

describe('ReportTable — sort and filter', () => {
  it('sorts text and money columns, money numerically', () => {
    renderRoute(<ReportTable columns={columns} data={data} totals={{ amount: 1034.5 }} />);
    expect(vendorsShown()).toEqual(['Zed', 'Acme', 'Mid']);
    fireEvent.click(screen.getByRole('button', { name: /^vendor/i }));
    expect(vendorsShown()).toEqual(['Acme', 'Mid', 'Zed']);
    // Money defaults to largest first; "1000.00" must not sort as text below "9.00".
    fireEvent.click(screen.getByRole('button', { name: /^amount/i }));
    expect(vendorsShown()).toEqual(['Acme', 'Mid', 'Zed']);
    fireEvent.click(screen.getByRole('button', { name: /^amount/i }));
    expect(vendorsShown()).toEqual(['Zed', 'Mid', 'Acme']);
  });

  it('filters a text column and recomputes the footer total over the visible rows', () => {
    renderRoute(<ReportTable columns={columns} data={data} totals={{ amount: 1034.5 }} />);
    expect(screen.getByText('$1,034.50')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Filter Vendor' }));
    fireEvent.click(screen.getByLabelText('Acme'));
    fireEvent.click(screen.getByLabelText('Mid'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(vendorsShown().sort()).toEqual(['Acme', 'Mid']);
    expect(screen.getByText('$1,025.50')).toBeTruthy();
    // Money columns carry a sort-only popover: no value checklist.
    fireEvent.click(screen.getByRole('button', { name: 'Filter Amount' }));
    const dialog = screen.getByRole('dialog', { name: 'Filter Amount' });
    expect(within(dialog).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(dialog).getAllByRole('button', { name: /^sort/i })).toHaveLength(2);
  });
});
