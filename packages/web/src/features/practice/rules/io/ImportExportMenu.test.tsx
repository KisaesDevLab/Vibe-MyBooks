// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../../../test-utils';

const { exportJsonFn, exportCsvFn, importFn } = vi.hoisted(() => ({
  exportJsonFn: vi.fn(),
  exportCsvFn: vi.fn(),
  importFn: vi.fn(),
}));

vi.mock('../../../../api/hooks/useRuleImportExport', () => ({
  useImportRules: () => ({ mutateAsync: importFn, isPending: false }),
  useExportJsonRules: () => ({ mutate: exportJsonFn, isPending: false }),
  useExportCsvRules: () => ({ mutate: exportCsvFn, isPending: false }),
}));

import { ImportExportMenu } from './ImportExportMenu';

describe('ImportExportMenu', () => {
  it('renders Import + Export JSON + Export CSV buttons', () => {
    renderRoute(<ImportExportMenu />);
    expect(screen.getByRole('button', { name: /Import/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export JSON/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export CSV/ })).toBeInTheDocument();
  });

  it('Export JSON button triggers the mutation', () => {
    renderRoute(<ImportExportMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Export JSON/ }));
    expect(exportJsonFn).toHaveBeenCalled();
  });

  it('Export CSV button triggers the mutation', () => {
    renderRoute(<ImportExportMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Export CSV/ }));
    expect(exportCsvFn).toHaveBeenCalled();
  });

  it('QBO format help toggle reveals stub explanation', () => {
    renderRoute(<ImportExportMenu />);
    fireEvent.click(screen.getByText(/QBO format/));
    expect(screen.getByText(/isn't supported yet/)).toBeInTheDocument();
  });
});
