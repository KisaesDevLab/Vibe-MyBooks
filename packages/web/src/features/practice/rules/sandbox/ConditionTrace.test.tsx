// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ConditionTraceWire } from '../../../../api/hooks/useRuleTestSandbox';
import { ConditionTrace } from './ConditionTrace';

describe('ConditionTrace', () => {
  it('renders a matched leaf with the field/operator/value', () => {
    const trace: ConditionTraceWire = {
      kind: 'leaf',
      field: 'descriptor',
      operator: 'contains',
      value: 'amazon',
      matched: true,
    };
    render(<ConditionTrace trace={trace} />);
    expect(screen.getByText(/descriptor/)).toBeInTheDocument();
    expect(screen.getByText(/contains/)).toBeInTheDocument();
    expect(screen.getByText(/"amazon"/)).toBeInTheDocument();
    expect(screen.getByLabelText('matched')).toBeInTheDocument();
  });

  it('renders a failed leaf with the no-match indicator', () => {
    const trace: ConditionTraceWire = {
      kind: 'leaf',
      field: 'amount',
      operator: 'gt',
      value: 100,
      matched: false,
    };
    render(<ConditionTrace trace={trace} />);
    expect(screen.getByLabelText('no match')).toBeInTheDocument();
  });

  it('renders an AND group with mixed children', () => {
    const trace: ConditionTraceWire = {
      kind: 'group',
      op: 'AND',
      matched: false,
      children: [
        { kind: 'leaf', field: 'descriptor', operator: 'contains', value: 'amazon', matched: true },
        { kind: 'leaf', field: 'amount', operator: 'gt', value: 1000, matched: false },
      ],
    };
    render(<ConditionTrace trace={trace} />);
    expect(screen.getByText(/AND group/)).toBeInTheDocument();
    // 1 matched leaf + 1 no-match leaf + 1 no-match group header
    expect(screen.getAllByLabelText('matched')).toHaveLength(1);
    expect(screen.getAllByLabelText('no match')).toHaveLength(2);
  });

  it('shows the leaf error string when present', () => {
    const trace: ConditionTraceWire = {
      kind: 'leaf',
      field: 'class_id',
      operator: 'eq',
      value: 'c1',
      matched: false,
      error: 'NOT_IMPLEMENTED',
    };
    render(<ConditionTrace trace={trace} />);
    expect(screen.getByText('NOT_IMPLEMENTED')).toBeInTheDocument();
  });

  it('formats array values', () => {
    const trace: ConditionTraceWire = {
      kind: 'leaf',
      field: 'amount',
      operator: 'between',
      value: [10, 100],
      matched: true,
    };
    render(<ConditionTrace trace={trace} />);
    expect(screen.getByText(/\[10, 100\]/)).toBeInTheDocument();
  });
});
