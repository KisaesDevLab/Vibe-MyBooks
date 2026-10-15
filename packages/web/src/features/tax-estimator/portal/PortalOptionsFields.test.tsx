// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// See LICENSE for terms.

// Q51: the per-contact portal options editor (taxpayer page + Client Portal > Edit contact).
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, render } from '@testing-library/react';
import { DEFAULT_PORTAL_CONTACT_TAX_OPTIONS } from '@kis-books/shared';
import { PortalOptionsFields } from './PortalOptionsFields';

describe('PortalOptionsFields (Q51)', () => {
  it('shows the defaults (today\'s view) and reports a change', () => {
    const onChange = vi.fn();
    render(<PortalOptionsFields idPrefix="t" value={{ ...DEFAULT_PORTAL_CONTACT_TAX_OPTIONS }} canGrant onChange={onChange} />);
    expect(screen.getByLabelText(/Quarterly estimates and vouchers/)).toBeChecked();
    expect(screen.getByLabelText(/Payments on record/)).toBeChecked();
    expect(screen.getByLabelText(/Calculation summary/)).not.toBeChecked();
    expect(screen.getByLabelText(/Download the estimate PDF/)).not.toBeChecked();
    fireEvent.click(screen.getByLabelText(/Download the estimate PDF/));
    expect(onChange).toHaveBeenCalledWith('pdfDownload', true);
  });

  it('without the grant right (tenant-side staff, Q41(7)) a section can be switched off but not on', () => {
    const onChange = vi.fn();
    render(<PortalOptionsFields idPrefix="t" value={{ ...DEFAULT_PORTAL_CONTACT_TAX_OPTIONS }} canGrant={false} onChange={onChange} />);
    expect(screen.getByLabelText(/Calculation summary/)).toBeDisabled();
    expect(screen.getByLabelText(/Download the estimate PDF/)).toBeDisabled();
    const quarterly = screen.getByLabelText(/Quarterly estimates and vouchers/);
    expect(quarterly).toBeEnabled();
    fireEvent.click(quarterly);
    expect(onChange).toHaveBeenCalledWith('quarterlyEstimates', false);
    expect(screen.getByText(/Turning one on needs firm staff/)).toBeInTheDocument();
  });
});
