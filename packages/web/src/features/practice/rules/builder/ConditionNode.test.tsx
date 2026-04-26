// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ConditionAST } from '@kis-books/shared';
import { ConditionNode } from './ConditionNode';

const ROOT_GROUP: ConditionAST = {
  type: 'group',
  op: 'AND',
  children: [
    { type: 'leaf', field: 'descriptor', operator: 'contains', value: 'amazon' },
  ],
};

describe('ConditionNode', () => {
  it('renders root group with AND toggle and one leaf', () => {
    render(<ConditionNode node={ROOT_GROUP} onChange={vi.fn()} isRoot />);
    expect(screen.getByRole('button', { name: /Toggle group operator/ })).toHaveTextContent('AND');
    expect(screen.getByDisplayValue('amazon')).toBeInTheDocument();
  });

  it('toggles AND ↔ OR via the operator button', () => {
    const onChange = vi.fn();
    render(<ConditionNode node={ROOT_GROUP} onChange={onChange} isRoot />);
    fireEvent.click(screen.getByRole('button', { name: /Toggle group operator/ }));
    expect(onChange).toHaveBeenCalledWith({ ...ROOT_GROUP, op: 'OR' });
  });

  it('Add condition appends a leaf to the children array', () => {
    const onChange = vi.fn();
    render(<ConditionNode node={ROOT_GROUP} onChange={onChange} isRoot />);
    fireEvent.click(screen.getByRole('button', { name: /Add condition/ }));
    const next = onChange.mock.calls[0]?.[0] as { children: unknown[] };
    expect(next.children).toHaveLength(2);
  });

  it('Add group nests a new group inside', () => {
    const onChange = vi.fn();
    render(<ConditionNode node={ROOT_GROUP} onChange={onChange} isRoot />);
    fireEvent.click(screen.getByRole('button', { name: /Add group/ }));
    const next = onChange.mock.calls[0]?.[0] as { children: Array<{ type: string }> };
    expect(next.children[1]?.type).toBe('group');
  });

  it('changing the field resets operator and value', () => {
    const onChange = vi.fn();
    render(<ConditionNode node={ROOT_GROUP} onChange={onChange} isRoot />);
    const fieldSelect = screen.getByLabelText('Field') as HTMLSelectElement;
    fireEvent.change(fieldSelect, { target: { value: 'amount' } });
    const next = onChange.mock.calls[0]?.[0] as { children: Array<{ field: string; operator: string }> };
    expect(next.children[0]?.field).toBe('amount');
    expect(next.children[0]?.operator).toBe('eq'); // first numeric operator
  });

  it('changing the operator while keeping the field updates only operator/value', () => {
    const onChange = vi.fn();
    render(<ConditionNode node={ROOT_GROUP} onChange={onChange} isRoot />);
    const opSelect = screen.getByLabelText('Operator') as HTMLSelectElement;
    fireEvent.change(opSelect, { target: { value: 'starts_with' } });
    const next = onChange.mock.calls[0]?.[0] as { children: Array<{ field: string; operator: string }> };
    expect(next.children[0]?.field).toBe('descriptor');
    expect(next.children[0]?.operator).toBe('starts_with');
  });

  it('removing a leaf via the trash button updates the children array', () => {
    const onChange = vi.fn();
    render(<ConditionNode node={ROOT_GROUP} onChange={onChange} isRoot />);
    fireEvent.click(screen.getByLabelText('Remove condition'));
    const next = onChange.mock.calls[0]?.[0] as { children: unknown[] };
    expect(next.children).toHaveLength(0);
  });

  it('shows empty-group message when no children', () => {
    const empty: ConditionAST = { type: 'group', op: 'AND', children: [] };
    render(<ConditionNode node={empty} onChange={vi.fn()} isRoot />);
    expect(screen.getByText(/Empty group/)).toBeInTheDocument();
  });

  it('renders a number input for amount fields', () => {
    const numericNode: ConditionAST = {
      type: 'group', op: 'AND',
      children: [{ type: 'leaf', field: 'amount', operator: 'gt', value: 100 }],
    };
    render(<ConditionNode node={numericNode} onChange={vi.fn()} isRoot />);
    const input = screen.getByDisplayValue('100') as HTMLInputElement;
    expect(input.type).toBe('number');
  });

  it('renders a date input for date.before', () => {
    const dateNode: ConditionAST = {
      type: 'group', op: 'AND',
      children: [{ type: 'leaf', field: 'date', operator: 'before', value: '2026-04-15' }],
    };
    render(<ConditionNode node={dateNode} onChange={vi.fn()} isRoot />);
    const input = screen.getByDisplayValue('2026-04-15') as HTMLInputElement;
    expect(input.type).toBe('date');
  });

  it('renders two inputs for between operator', () => {
    const betweenNode: ConditionAST = {
      type: 'group', op: 'AND',
      children: [{ type: 'leaf', field: 'amount', operator: 'between', value: [10, 50] }],
    };
    render(<ConditionNode node={betweenNode} onChange={vi.fn()} isRoot />);
    expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    expect(screen.getByDisplayValue('50')).toBeInTheDocument();
  });
});
