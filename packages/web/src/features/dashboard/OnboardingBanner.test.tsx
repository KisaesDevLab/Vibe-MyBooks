// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../../test-utils';
import {
  OnboardingBanner,
  isOnboardingDismissed,
  dismissOnboarding,
} from './OnboardingBanner';

describe('OnboardingBanner', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders all three tasks on a fresh tenant', () => {
    renderRoute(<OnboardingBanner hasBanking={false} hasInvoices={false} hasTeam={false} />);
    expect(screen.getByText(/connect a bank account/i)).toBeInTheDocument();
    expect(screen.getByText(/create your first invoice/i)).toBeInTheDocument();
    expect(screen.getByText(/add a team member/i)).toBeInTheDocument();
  });

  it('renders nothing once every task is complete', () => {
    renderRoute(<OnboardingBanner hasBanking hasInvoices hasTeam />);
    expect(screen.queryByText(/get started with vibe mybooks/i)).not.toBeInTheDocument();
  });

  it('strikes through completed tasks and hides their CTA', () => {
    renderRoute(<OnboardingBanner hasBanking hasInvoices={false} hasTeam={false} />);
    // Banking is done — its title should appear but there's no Connect CTA.
    expect(screen.getByText(/connect a bank account/i)).toBeInTheDocument();
    // Only the remaining two tasks should expose CTAs.
    expect(screen.getByRole('link', { name: /create/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /invite/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /connect/i })).not.toBeInTheDocument();
  });

  it('dismiss button persists + hides the banner', async () => {
    const user = userEvent.setup();
    renderRoute(<OnboardingBanner hasBanking={false} hasInvoices={false} hasTeam={false} />);
    expect(isOnboardingDismissed()).toBe(false);
    await user.click(screen.getByRole('button', { name: /dismiss onboarding tips/i }));
    expect(isOnboardingDismissed()).toBe(true);
    // Banner should be gone from the DOM.
    expect(screen.queryByText(/get started with vibe mybooks/i)).not.toBeInTheDocument();
  });

  it('hidden on mount when previously dismissed', () => {
    dismissOnboarding();
    renderRoute(<OnboardingBanner hasBanking={false} hasInvoices={false} hasTeam={false} />);
    expect(screen.queryByText(/get started with vibe mybooks/i)).not.toBeInTheDocument();
  });
});
