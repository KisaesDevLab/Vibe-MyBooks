// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SplitRowV2 } from './SplitRowV2';

function renderRow(overrides: Partial<Parameters<typeof SplitRowV2>[0]> = {}) {
  return render(
    <SplitRowV2
      index={0}
      total={2}
      line1={<input data-testid="l1" placeholder="line1" />}
      line2={<input data-testid="l2" placeholder="line2" />}
      {...overrides}
    />,
  );
}

describe('SplitRowV2', () => {
  it('renders with an accessible group label', () => {
    renderRow({ index: 1, total: 4 });
    expect(screen.getByText('Split 2 of 4')).toBeInTheDocument();
  });

  it('calls onDelete when the delete button is clicked', () => {
    const onDelete = vi.fn();
    renderRow({ onDelete });
    fireEvent.click(screen.getByLabelText(/Delete split/));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onDuplicate when the duplicate button is clicked', () => {
    const onDuplicate = vi.fn();
    renderRow({ onDuplicate });
    fireEvent.click(screen.getByLabelText(/Duplicate split/));
    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  it('calls onDuplicate on Cmd/Ctrl+D keyboard shortcut', () => {
    const onDuplicate = vi.fn();
    renderRow({ onDuplicate });
    const input = screen.getByTestId('l1');
    fireEvent.keyDown(input, { key: 'd', ctrlKey: true });
    expect(onDuplicate).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete on Cmd/Ctrl+Backspace', () => {
    const onDelete = vi.fn();
    renderRow({ onDelete });
    const input = screen.getByTestId('l1');
    fireEvent.keyDown(input, { key: 'Backspace', metaKey: true });
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('only fires onApplyTagToAll when isFirst + shortcut match', () => {
    const onApplyTagToAll = vi.fn();
    const { rerender } = renderRow({ onApplyTagToAll, isFirst: false });
    fireEvent.keyDown(screen.getByTestId('l1'), {
      key: 'a', ctrlKey: true, shiftKey: true,
    });
    expect(onApplyTagToAll).not.toHaveBeenCalled();

    rerender(
      <SplitRowV2
        index={0}
        total={2}
        isFirst
        onApplyTagToAll={onApplyTagToAll}
        line1={<input data-testid="l1" />}
        line2={<input data-testid="l2" />}
      />,
    );
    fireEvent.keyDown(screen.getByTestId('l1'), {
      key: 'a', ctrlKey: true, shiftKey: true,
    });
    expect(onApplyTagToAll).toHaveBeenCalledTimes(1);
  });

  it('fires onAddRow on plain Enter in a text input', () => {
    const onAddRow = vi.fn();
    renderRow({ onAddRow });
    fireEvent.keyDown(screen.getByTestId('l2'), { key: 'Enter' });
    expect(onAddRow).toHaveBeenCalledTimes(1);
  });

  it('renders row-level error strip when errorMessage is given', () => {
    renderRow({ errorMessage: 'oops' });
    expect(screen.getByText('oops')).toBeInTheDocument();
  });
});
