// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

// A component that throws on render — used to drive the boundary into its
// error state. We wrap console.error so the test output stays clean; React
// logs the caught error by default.
function Boom({ message }: { message: string }): JSX.Element {
  throw new Error(message);
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('renders the fallback UI when a child throws and surfaces the error message', () => {
    render(
      <ErrorBoundary>
        <Boom message="unexpected render failure" />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.getByText(/unexpected render failure/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
  });

  it('falls back to a generic message when the error has no message', () => {
    function BoomSilent(): JSX.Element {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw new Error('');
    }
    render(
      <ErrorBoundary>
        <BoomSilent />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/an unexpected error occurred/i)).toBeInTheDocument();
  });
});
