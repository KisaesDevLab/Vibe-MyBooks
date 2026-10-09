// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect } from 'vitest';
import { filenameFromDisposition } from './useReportPacks';

describe('filenameFromDisposition', () => {
  it('prefers filename*, falls back to filename, and handles a missing header', () => {
    expect(filenameFromDisposition(`attachment; filename="A.pdf"; filename*=UTF-8''TimberStone_LLC_-_2026-09-01_to_2026-09-30.pdf`))
      .toBe('TimberStone_LLC_-_2026-09-01_to_2026-09-30.pdf');
    expect(filenameFromDisposition('attachment; filename="Month_End-2026-09-30.pdf"')).toBe('Month_End-2026-09-30.pdf');
    expect(filenameFromDisposition(null)).toBeNull();
  });
});
