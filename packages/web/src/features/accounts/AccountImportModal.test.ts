// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect } from 'vitest';
import { parseCsv, normalizeType } from './AccountImportModal';

describe('AccountImportModal CSV parsing', () => {
  it('handles CRLF line endings and a UTF-8 BOM', () => {
    const rows = parseCsv('﻿Account Number,Name,Type\r\n10100,Cash,asset\r\n');
    expect(rows).toEqual([
      ['Account Number', 'Name', 'Type'],
      ['10100', 'Cash', 'asset'],
    ]);
  });

  it('keeps commas inside quoted fields together', () => {
    const rows = parseCsv('Number,Name,Type\n62110,"Loans, Leases & Cards",expense\n');
    expect(rows[1]).toEqual(['62110', 'Loans, Leases & Cards', 'expense']);
  });

  it('unescapes doubled quotes', () => {
    const rows = parseCsv('Number,Name\n1,"He said ""hi"""\n');
    expect(rows[1]).toEqual(['1', 'He said "hi"']);
  });

  it('drops blank trailing lines', () => {
    const rows = parseCsv('Number,Name\n1,Cash\n\n');
    expect(rows).toHaveLength(2);
  });

  it('normalizes type spellings from other products', () => {
    expect(normalizeType('Income')).toBe('revenue');
    expect(normalizeType('Cost of Goods Sold')).toBe('cogs');
    expect(normalizeType('Other Expense')).toBe('other_expense');
    expect(normalizeType(' ASSET ')).toBe('asset');
  });
});
