// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';

// vi.mock factories hoist above all variable declarations.
// vi.hoisted runs synchronously before the mocks resolve so the
// shared spy can be referenced inside the factory and asserted on
// in the test. The threshold object is also hoisted (and shared)
// so the page hook returns the SAME reference on every render —
// otherwise a fresh object per render would break the page's
// useEffect deps and put the worker into an infinite-loop OOM.
const { mutateFn, STABLE_RESPONSE } = vi.hoisted(() => ({
  mutateFn: vi.fn(),
  STABLE_RESPONSE: {
    data: {
      classificationThresholds: {
        bucket3HighConfidence: 0.95,
        bucket3HighVendorConsistency: 0.95,
        bucket3MediumConfidence: 0.7,
        bucket4Floor: 0.7,
      },
    },
    isLoading: false,
  },
}));

vi.mock('../../../api/hooks/usePracticeSettings', () => ({
  useThresholds: () => STABLE_RESPONSE,
  useSetThresholds: () => ({ mutate: mutateFn, isPending: false }),
}));

import { PracticeSettingsPage } from './PracticeSettingsPage';

describe('PracticeSettingsPage', () => {
  it('renders the four threshold fields pre-populated', async () => {
    renderRoute(<PracticeSettingsPage />);
    await waitFor(() => {
      const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
      expect(inputs).toHaveLength(4);
      expect(inputs[0]?.value).toBe('0.95');
    });
  });

  it('submits parsed numeric values via useSetThresholds', async () => {
    const { container } = renderRoute(<PracticeSettingsPage />);
    await waitFor(() => screen.getAllByRole('spinbutton'));
    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    fireEvent.change(inputs[3]!, { target: { value: '0.6' } });
    const form = container.querySelector('form')!;
    fireEvent.submit(form);
    await waitFor(() => expect(mutateFn).toHaveBeenCalled());
  });

  it('shows an inline error when a value is out of [0,1]', async () => {
    const { container } = renderRoute(<PracticeSettingsPage />);
    await waitFor(() => screen.getAllByRole('spinbutton'));
    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    fireEvent.change(inputs[3]!, { target: { value: '1.5' } });
    const form = container.querySelector('form')!;
    fireEvent.submit(form);
    await waitFor(() =>
      expect(screen.getByText(/between 0 and 1/)).toBeInTheDocument(),
    );
  });
});
