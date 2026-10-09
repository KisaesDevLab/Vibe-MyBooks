// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommitInput } from './CommitInput';

describe('CommitInput', () => {
  it('does not commit while typing; commits on Enter and on blur', () => {
    const onCommit = vi.fn();
    render(<CommitInput aria-label="q" value="" onCommit={onCommit} />);
    const el = screen.getByLabelText('q');
    fireEvent.keyDown(el, { key: 'a' });
    fireEvent.change(el, { target: { value: 'acme' } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.keyDown(el, { key: 'Enter' });
    expect(onCommit).toHaveBeenLastCalledWith('acme');

    onCommit.mockClear();
    fireEvent.keyDown(el, { key: 'x' });
    fireEvent.change(el, { target: { value: 'acmex' } });
    fireEvent.blur(el);
    expect(onCommit).toHaveBeenCalledWith('acmex');
  });

  it('Escape reverts the draft to the committed value', () => {
    const onCommit = vi.fn();
    render(<CommitInput aria-label="q" value="old" onCommit={onCommit} />);
    const el = screen.getByLabelText('q') as HTMLInputElement;
    fireEvent.keyDown(el, { key: 'n' });
    fireEvent.change(el, { target: { value: 'new' } });
    fireEvent.keyDown(el, { key: 'Escape' });
    expect(el.value).toBe('old');
    fireEvent.blur(el);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('a typed date waits for Enter or blur', () => {
    const onCommit = vi.fn();
    render(<CommitInput aria-label="d" type="date" value="2025-01-01" onCommit={onCommit} />);
    const el = screen.getByLabelText('d') as HTMLInputElement;
    fireEvent.keyDown(el, { key: '9' });
    fireEvent.change(el, { target: { value: '2025-09-01' } });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.keyDown(el, { key: 'Enter' });
    expect(onCommit).toHaveBeenLastCalledWith('2025-09-01');
  });

  it('a date picked from the calendar (no keystroke) commits immediately', () => {
    const onCommit = vi.fn();
    render(<CommitInput aria-label="d" type="date" value="" onCommit={onCommit} />);
    fireEvent.change(screen.getByLabelText('d'), { target: { value: '2025-09-16' } });
    expect(onCommit).toHaveBeenCalledWith('2025-09-16');
  });

  it('follows outside value changes (Clear button)', () => {
    const { rerender } = render(<CommitInput aria-label="q" value="acme" onCommit={vi.fn()} />);
    rerender(<CommitInput aria-label="q" value="" onCommit={vi.fn()} />);
    expect((screen.getByLabelText('q') as HTMLInputElement).value).toBe('');
  });
});
