// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { useRef } from 'react';
import { useReviewKeyboardShortcuts, type ShortcutHandlers } from './useReviewKeyboardShortcuts';

function Harness({ handlers, enabled = true }: { handlers: ShortcutHandlers; enabled?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useReviewKeyboardShortcuts(ref, handlers, enabled);
  // The real Close Review surface focuses table rows (tabIndex=0)
  // — not buttons — when the bookkeeper hovers/tabs through the
  // list. The harness mirrors that with a focusable div so the
  // hook's button-blocking logic doesn't swallow the shortcut.
  return (
    <div ref={ref} data-testid="container" tabIndex={0}>
      <div data-testid="focus-target" tabIndex={0}>
        Focus me
      </div>
      <button data-testid="button-target">Approve</button>
      <input data-testid="text-input" type="text" />
    </div>
  );
}

beforeEach(() => {
  cleanup();
});

describe('useReviewKeyboardShortcuts', () => {
  it('calls onToggleSelect on Space when focus is in subtree', () => {
    const onToggleSelect = vi.fn();
    const { getByTestId } = render(<Harness handlers={{ onToggleSelect }} />);
    const btn = getByTestId('focus-target');
    btn.focus();
    fireEvent.keyDown(document, { key: ' ', code: 'Space' });
    expect(onToggleSelect).toHaveBeenCalledTimes(1);
  });

  it('calls onApprove on Enter when focused', () => {
    const onApprove = vi.fn();
    const { getByTestId } = render(<Harness handlers={{ onApprove }} />);
    getByTestId('focus-target').focus();
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it('calls onApproveAll on "A" when focused', () => {
    const onApproveAll = vi.fn();
    const { getByTestId } = render(<Harness handlers={{ onApproveAll }} />);
    getByTestId('focus-target').focus();
    fireEvent.keyDown(document, { key: 'a' });
    expect(onApproveAll).toHaveBeenCalledTimes(1);
  });

  it('ignores shortcuts when focus is outside the subtree', () => {
    const onApprove = vi.fn();
    render(<Harness handlers={{ onApprove }} />);
    document.body.focus();
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onApprove).not.toHaveBeenCalled();
  });

  it('ignores Space when focused on a text input', () => {
    const onToggleSelect = vi.fn();
    const { getByTestId } = render(<Harness handlers={{ onToggleSelect }} />);
    getByTestId('text-input').focus();
    fireEvent.keyDown(document, { key: ' ' });
    expect(onToggleSelect).not.toHaveBeenCalled();
  });

  it('ignores Ctrl+A so browser select-all still works', () => {
    const onApproveAll = vi.fn();
    const { getByTestId } = render(<Harness handlers={{ onApproveAll }} />);
    getByTestId('focus-target').focus();
    fireEvent.keyDown(document, { key: 'a', ctrlKey: true });
    expect(onApproveAll).not.toHaveBeenCalled();
  });

  it('defers Enter to a focused button (button activates itself)', () => {
    const onApprove = vi.fn();
    const { getByTestId } = render(<Harness handlers={{ onApprove }} />);
    getByTestId('button-target').focus();
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onApprove).not.toHaveBeenCalled();
  });

  it('ignores everything when enabled=false', () => {
    const onApprove = vi.fn();
    const onApproveAll = vi.fn();
    const { getByTestId } = render(
      <Harness handlers={{ onApprove, onApproveAll }} enabled={false} />,
    );
    getByTestId('focus-target').focus();
    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'a' });
    expect(onApprove).not.toHaveBeenCalled();
    expect(onApproveAll).not.toHaveBeenCalled();
  });
});
