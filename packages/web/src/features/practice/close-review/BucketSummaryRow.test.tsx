// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { BucketSummary } from '@kis-books/shared';
import { BucketSummaryRow } from './BucketSummaryRow';

const FULL_SUMMARY: BucketSummary = {
  periodStart: '2026-04-01T00:00:00.000Z',
  periodEnd: '2026-05-01T00:00:00.000Z',
  buckets: {
    potential_match: 2,
    rule: 3,
    auto_high: 4,
    auto_medium: 5,
    needs_review: 6,
  },
  totalUncategorized: 20,
  totalApproved: 0,
  findingsCount: 0,
};

describe('BucketSummaryRow', () => {
  it('renders all five tiles with counts', () => {
    render(<BucketSummaryRow summary={FULL_SUMMARY} />);
    expect(screen.getByText('Potential Matches')).toBeInTheDocument();
    expect(screen.getByText('Rules')).toBeInTheDocument();
    expect(screen.getByText('Auto Classifications')).toBeInTheDocument();
    expect(screen.getByText('Needs Review')).toBeInTheDocument();
    expect(screen.getByText('Findings')).toBeInTheDocument();
  });

  it('sums auto_high and auto_medium under one tile', () => {
    render(<BucketSummaryRow summary={FULL_SUMMARY} />);
    // 4 + 5 = 9 — scan the DOM for that figure.
    expect(screen.getByText('9')).toBeInTheDocument();
  });

  it('renders zeros when summary is undefined', () => {
    render(<BucketSummaryRow summary={undefined} />);
    // Five tiles × "0" — use all matcher.
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(5);
  });

  it('fires onBucketClick with the tile identifier', () => {
    const onClick = vi.fn();
    render(<BucketSummaryRow summary={FULL_SUMMARY} onBucketClick={onClick} />);
    fireEvent.click(screen.getByText('Needs Review'));
    expect(onClick).toHaveBeenCalledWith('needs_review');
  });

  it('Findings tile is not clickable (Phase 6 placeholder)', () => {
    const onClick = vi.fn();
    render(<BucketSummaryRow summary={FULL_SUMMARY} onBucketClick={onClick} />);
    fireEvent.click(screen.getByText('Findings'));
    expect(onClick).not.toHaveBeenCalledWith('findings' as never);
  });
});
