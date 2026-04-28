// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { BucketReceiptOcr } from '@kis-books/shared';
import { ReceiptComparisonPanel } from './ReceiptComparisonPanel';

const matchingOcr: BucketReceiptOcr = {
  attachmentId: 'a-1',
  vendor: 'Acme Hardware',
  date: '2026-04-15',
  total: '50.00',
  tax: null,
};

const mismatchedOcr: BucketReceiptOcr = {
  attachmentId: 'a-2',
  vendor: 'Acme Hardware',
  date: '2026-04-15',
  total: '60.00',
  tax: null,
};

describe('ReceiptComparisonPanel', () => {
  it('renders the matched-amount state when within tolerance', () => {
    render(
      <ReceiptComparisonPanel
        ocr={matchingOcr}
        bankAmount={50}
        bankDescription="Acme Hardware"
        bankDate="2026-04-15"
      />,
    );
    expect(screen.getByText(/Receipt matches bank/i)).toBeInTheDocument();
    // Bank + receipt totals both show.
    const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    expect(screen.getAllByText(fmt.format(50)).length).toBeGreaterThanOrEqual(1);
  });

  it('renders the mismatch state when variance exceeds tolerance', () => {
    render(
      <ReceiptComparisonPanel
        ocr={mismatchedOcr}
        bankAmount={50}
        bankDescription="Acme Hardware"
        bankDate="2026-04-15"
      />,
    );
    expect(screen.getByText(/Receipt amount differs from bank/i)).toBeInTheDocument();
    expect(screen.getByText(/Variance/i)).toBeInTheDocument();
  });

  it('handles missing OCR total gracefully', () => {
    const noTotal: BucketReceiptOcr = { ...matchingOcr, total: null };
    render(
      <ReceiptComparisonPanel
        ocr={noTotal}
        bankAmount={50}
        bankDescription="Acme Hardware"
        bankDate="2026-04-15"
      />,
    );
    // Falls back to em-dash when total is null; variance section
    // is suppressed because there's nothing to compare.
    expect(screen.queryByText(/Variance/i)).toBeNull();
  });
});
