// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// The reminder template editor edits ONE (trigger, channel) pair. Changing
// either picks a different template, so the fields have to follow: they did
// not, and choosing "Magic-link expiring" left the unanswered-question
// wording on screen — which saving would have written under the new trigger.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderRoute } from '../../../test-utils';

vi.mock('../../../providers/CompanyProvider', () => ({
  useCompanyContext: () => ({ activeCompanyId: 'co1', activeCompanyName: 'Co', companies: [] }),
}));

import { TemplatesSection } from './RemindersPage';

const templates = [
  { id: 't1', triggerType: 'unanswered_question', channel: 'email', subject: 'You have new questions waiting', body: 'Hi {first_name}, {open_count} question(s).' },
  { id: 't2', triggerType: 'magic_link_expiring', channel: 'email', subject: 'Your sign-in link is about to expire', body: 'Hi {first_name}, your link expires soon.' },
];

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ templates }) })));
});
afterEach(() => vi.unstubAllGlobals());

async function openEditor() {
  renderRoute(<TemplatesSection />);
  const rows = await screen.findAllByRole('button', { name: 'Edit' });
  fireEvent.click(rows[0]!);
  await waitFor(() => screen.getByText('Reminder template'));
}

describe('reminder template editor', () => {
  it('loads the template the chosen trigger actually has', async () => {
    await openEditor();
    expect(screen.getByDisplayValue('You have new questions waiting')).toBeTruthy();

    fireEvent.change(screen.getByDisplayValue('Unanswered question'), { target: { value: 'magic_link_expiring' } });
    await waitFor(() => screen.getByDisplayValue('Your sign-in link is about to expire'));
    expect(screen.queryByDisplayValue('You have new questions waiting')).toBeNull();
  });

  it('empties the fields for a trigger with no template yet', async () => {
    await openEditor();
    fireEvent.change(screen.getByDisplayValue('Unanswered question'), { target: { value: 'w9_pending' } });
    await waitFor(() => expect(screen.queryByDisplayValue('You have new questions waiting')).toBeNull());
    expect(screen.getByText(/built-in wording/i)).toBeTruthy();
  });

  it('names the variables that trigger actually renders', async () => {
    await openEditor();
    // Scoped to the hint line: the body textarea quotes variables too.
    const hint = () => screen.getByText(/^Variables:/).textContent ?? '';
    expect(hint()).toContain('{open_count}');
    fireEvent.change(screen.getByDisplayValue('Unanswered question'), { target: { value: 'categorize_reminder' } });
    await waitFor(() => expect(hint()).toContain('{company_name}'));
    expect(hint()).not.toContain('{open_count}');
  });
});
