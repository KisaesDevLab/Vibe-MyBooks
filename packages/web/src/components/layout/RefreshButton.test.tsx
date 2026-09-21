// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Header refresh button:
//   - one click refetches the queries on screen (invalidate-all)
//   - the icon spins and aria-busy is set while that is in flight
//   - a second click while refreshing is ignored

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { renderRoute } from '../../test-utils';
import { RefreshButton } from './RefreshButton';

function Harness({ fetcher }: { fetcher: () => Promise<number> }) {
  const { data } = useQuery({ queryKey: ['widgets'], queryFn: fetcher });
  return (
    <>
      <RefreshButton />
      <span data-testid="value">{data ?? ''}</span>
    </>
  );
}

describe('RefreshButton', () => {
  it('refetches active queries and shows a busy state while doing so', async () => {
    let n = 0;
    const fetcher = vi.fn(async () => ++n);
    renderRoute(<Harness fetcher={fetcher} />);

    await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('1'));

    const btn = screen.getByRole('button', { name: 'Refresh data' });
    expect(btn.getAttribute('aria-busy')).toBe('false');

    fireEvent.click(btn);
    expect(btn.getAttribute('aria-busy')).toBe('true');
    // Ignored while a refresh is already running.
    fireEvent.click(btn);

    await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('2'));
    await waitFor(() => expect(btn.getAttribute('aria-busy')).toBe('false'), { timeout: 2000 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
