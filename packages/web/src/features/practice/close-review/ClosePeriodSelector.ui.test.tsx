// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClosePeriodSelector, periodForMonth } from './ClosePeriodSelector';

const NOW = new Date(Date.UTC(2026, 8, 25)); // September 2026

describe('ClosePeriodSelector', () => {
  it('steps back and forward a month', () => {
    const onChange = vi.fn();
    render(<ClosePeriodSelector value={periodForMonth(2026, 7, NOW)} onChange={onChange} now={NOW} />);
    fireEvent.click(screen.getByLabelText('Previous month'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ label: 'July 2026' }));
    fireEvent.click(screen.getByLabelText('Next month'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ label: 'September 2026 (current)' }));
  });

  it('reaches years back through the year list', () => {
    const onChange = vi.fn();
    render(<ClosePeriodSelector value={periodForMonth(2026, 7, NOW)} onChange={onChange} now={NOW} />);
    fireEvent.change(screen.getByLabelText('Close year'), { target: { value: '2021' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ label: 'August 2021' }));
  });

  it('never moves past the current month', () => {
    const onChange = vi.fn();
    render(<ClosePeriodSelector value={periodForMonth(2026, 8, NOW)} onChange={onChange} now={NOW} />);
    expect((screen.getByLabelText('Next month') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Close year'), { target: { value: '2026' } });
    fireEvent.change(screen.getByLabelText('Close month'), { target: { value: '11' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ label: 'September 2026 (current)' }));
  });
});
