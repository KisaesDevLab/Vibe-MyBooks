// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, render } from '@testing-library/react';
import type { StateRuleRowDTO, TaxParameterRowDTO } from '@kis-books/shared';
import { StateRuleModal } from './StateRuleModal';
import { OverrideModal } from './OverrideModal';

const DATES = ['2026-04-15', '2026-06-15', '2026-09-15', '2027-01-15'];
const srow = (key: string, type: StateRuleRowDTO['type'], value: unknown): StateRuleRowDTO =>
  ({ state: 'MO', key, label: key, type, value, status: 'verified', source: 'seed', citation: 'x' });

describe('QA D6: installment pair editing', () => {
  it('state: "0.25" against four due dates is refused before saving; editing both halves sends a companion', () => {
    const onSave = vi.fn();
    render(<StateRuleModal row={srow('installments.pcts', 'rate_list', [0.25, 0.25, 0.25, 0.25])}
      partner={srow('installments.due_dates', 'date_list', DATES)} saving={false} onSave={onSave} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Value (rate_list)'), { target: { value: '0.25' } });
    fireEvent.change(screen.getByLabelText('Reason (audited)'), { target: { value: 'QA D6' } });
    expect(screen.getByTestId('pair-error')).toHaveTextContent(/add up to 100%/);
    fireEvent.click(screen.getByRole('button', { name: 'Save override' }));
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Value (rate_list)'), { target: { value: '0.5, 0.5' } });
    expect(screen.getByTestId('pair-error')).toHaveTextContent(/has 2 entries but installments.due_dates has 4/);
    fireEvent.change(screen.getByLabelText(/installments.due_dates.*saved together/), { target: { value: '2026-04-15, 2026-09-15' } });
    expect(screen.queryByTestId('pair-error')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save override' }));
    expect(onSave).toHaveBeenCalledWith([0.5, 0.5], 'QA D6', { key: 'installments.due_dates', value: ['2026-04-15', '2026-09-15'] });
  });

  it('federal: the same check on installments.pcts', () => {
    const frow = (key: string, type: TaxParameterRowDTO['type'], value: unknown) =>
      ({ key, label: key, type, value, status: 'verified', source: 'seed', citation: 'x' }) as unknown as TaxParameterRowDTO;
    const onSave = vi.fn();
    render(<OverrideModal row={frow('installments.pcts', 'rate_list', [0.25, 0.25, 0.25, 0.25])}
      partner={frow('installments.due_dates', 'date_list', DATES)} saving={false} onSave={onSave} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Value (rate_list)'), { target: { value: '[0.25]' } });
    fireEvent.change(screen.getByLabelText('Reason (audited)'), { target: { value: 'QA D6' } });
    expect(screen.getByTestId('pair-error')).toHaveTextContent(/add up to 100%/);
    fireEvent.click(screen.getByRole('button', { name: 'Save override' }));
    expect(onSave).not.toHaveBeenCalled();
  });
});
