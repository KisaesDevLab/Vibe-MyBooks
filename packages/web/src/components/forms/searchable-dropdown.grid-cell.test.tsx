// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Grid navigation (Batch Entry): the grid moves focus by querying
// `[data-cell="r-c"]`. The dropdown must stamp that coordinate on its input
// or Tab / Enter skip straight past every Payee / Account column.

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchableDropdown } from './SearchableDropdown';

const OPTIONS = [{ id: 'a', label: 'Alpha' }];

describe('SearchableDropdown in a grid', () => {
  it('stamps data-cell on its input so the grid can focus it', () => {
    const { container } = render(
      <SearchableDropdown value="" onChange={() => {}} options={OPTIONS} placeholder="pick" dataCell="3-2" onNavigate={() => {}} />,
    );
    expect(container.querySelector('[data-cell="3-2"]')).toBe(screen.getByPlaceholderText('pick'));
  });

  it('Tab / Shift+Tab hand focus back to the grid', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    render(<SearchableDropdown value="" onChange={() => {}} options={OPTIONS} placeholder="pick" dataCell="0-1" onNavigate={onNavigate} />);
    await user.click(screen.getByPlaceholderText('pick'));
    await user.tab();
    expect(onNavigate).toHaveBeenLastCalledWith('next');
    await user.click(screen.getByPlaceholderText('pick'));
    await user.tab({ shift: true });
    expect(onNavigate).toHaveBeenLastCalledWith('prev');
  });
});
