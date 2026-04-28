// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderRoute } from '../../../../test-utils';

const { suggestionsData } = vi.hoisted(() => ({
  suggestionsData: { data: { suggestions: [] as Array<unknown> } },
}));

vi.mock('../../../../api/hooks/useRuleSuggestions', () => ({
  useRuleSuggestions: () => suggestionsData,
}));
vi.mock('../../../../api/hooks/useConditionalRules', () => ({
  useCreateConditionalRule: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { SuggestionsBanner } from './SuggestionsBanner';

describe('SuggestionsBanner', () => {
  it('renders nothing when no suggestions', () => {
    suggestionsData.data = { suggestions: [] };
    const { container } = renderRoute(<SuggestionsBanner />);
    expect(container.querySelector('button')).toBeNull();
  });

  it('renders banner with count when suggestions present', () => {
    suggestionsData.data = {
      suggestions: [
        { payeePattern: 'amazon', accountId: 'a', accountName: 'Office', timesConfirmed: 8, overrideRate: 0.05, proposedRule: { name: 'Amazon → Office', conditions: { type: 'leaf', field: 'descriptor', operator: 'contains', value: 'amazon' }, actions: [{ type: 'set_account', accountId: 'a' }] } },
        { payeePattern: 'verizon', accountId: 'b', accountName: 'Phone', timesConfirmed: 12, overrideRate: 0, proposedRule: { name: 'Verizon → Phone', conditions: { type: 'leaf', field: 'descriptor', operator: 'contains', value: 'verizon' }, actions: [{ type: 'set_account', accountId: 'b' }] } },
      ],
    };
    renderRoute(<SuggestionsBanner />);
    expect(screen.getByText(/2 potential rules detected/)).toBeInTheDocument();
  });

  it('opens modal on click', () => {
    suggestionsData.data = {
      suggestions: [
        { payeePattern: 'amazon', accountId: 'a', accountName: 'Office', timesConfirmed: 8, overrideRate: 0.05, proposedRule: { name: 'Amazon → Office', conditions: { type: 'leaf', field: 'descriptor', operator: 'contains', value: 'amazon' }, actions: [{ type: 'set_account', accountId: 'a' }] } },
      ],
    };
    renderRoute(<SuggestionsBanner />);
    fireEvent.click(screen.getByText(/1 potential rule detected/));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Amazon → Office')).toBeInTheDocument();
  });

  it('singular form for one suggestion', () => {
    suggestionsData.data = {
      suggestions: [
        { payeePattern: 'amazon', accountId: 'a', accountName: 'Office', timesConfirmed: 8, overrideRate: 0.05, proposedRule: { name: 'Amazon → Office', conditions: { type: 'leaf', field: 'descriptor', operator: 'contains', value: 'amazon' }, actions: [{ type: 'set_account', accountId: 'a' }] } },
      ],
    };
    renderRoute(<SuggestionsBanner />);
    expect(screen.getByText(/1 potential rule detected/)).toBeInTheDocument();
  });
});
