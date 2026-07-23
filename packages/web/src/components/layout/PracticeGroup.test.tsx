// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import type { PracticeFeatureFlagKey, FeatureFlagStatus, FeatureFlagsResponse } from '@kis-books/shared';
import { renderRoute } from '../../test-utils';

// We have to stub both hooks that PracticeGroup consumes — the
// usePracticeVisibility derivation is what the DOM reflects. Using
// vi.mock at module load keeps the stubs in place for every test
// in this file.
const meResult = { data: undefined as unknown };
const flagsResult = { data: undefined as unknown };
// Firm membership feeds the practice-staff gate: bookkeeper/accountant
// roles qualify on their own, so an empty firm list keeps the legacy
// test expectations; owner-role tests set a membership explicitly.
const firmsResult = { data: { firms: [] as unknown[] } as unknown };

vi.mock('../../api/hooks/useAuth', () => ({
  useMe: () => meResult,
}));

vi.mock('../../api/hooks/useFeatureFlag', () => ({
  useFeatureFlags: () => flagsResult,
  useFeatureFlag: () => undefined,
}));

vi.mock('../../api/hooks/useFirms', () => ({
  useFirms: () => firmsResult,
}));

// Import AFTER the mocks so PracticeGroup picks up the stubs.
import { PracticeGroup } from './PracticeGroup';

function buildFlags(enabledKeys: readonly PracticeFeatureFlagKey[]): FeatureFlagsResponse {
  const all: PracticeFeatureFlagKey[] = [
    'CLOSE_REVIEW_V1',
    'AI_BUCKET_WORKFLOW_V1',
    'CONDITIONAL_RULES_V1',
    'CLIENT_PORTAL_V1',
    'REMINDERS_V1',
    'TAX_1099_V1',
    'REPORT_BUILDER_V1',
    'RECEIPT_PWA_V1',
  ];
  const flags: Record<PracticeFeatureFlagKey, FeatureFlagStatus> = {} as never;
  for (const k of all) {
    flags[k] = {
      enabled: enabledKeys.includes(k),
      rolloutPercent: 0,
      activatedAt: null,
    };
  }
  return { flags };
}

function setFirmMembership(isMember: boolean) {
  firmsResult.data = { firms: isMember ? [{ id: 'f1', name: 'Firm', slug: 'firm' }] : [] };
}

function setMe(user: { role: string; userType?: 'staff' | 'client'; isSuperAdmin?: boolean }) {
  meResult.data = {
    user: {
      id: 'u1',
      email: 'test@example.com',
      isSuperAdmin: user.isSuperAdmin ?? false,
      role: user.role,
      userType: user.userType ?? 'staff',
      displayPreferences: {},
    },
    companies: [],
    accessibleTenants: [],
    activeTenantId: 't1',
  };
}

function setFlags(enabled: readonly PracticeFeatureFlagKey[]) {
  flagsResult.data = buildFlags(enabled);
}

beforeEach(() => {
  meResult.data = undefined;
  flagsResult.data = undefined;
  firmsResult.data = { firms: [] };
});

describe('PracticeGroup', () => {
  it('renders nothing while me / flags still loading', () => {
    const { container } = renderRoute(<PracticeGroup />);
    expect(container.querySelector('[data-testid="practice-group"]')).toBeNull();
  });

  it('renders nothing for client user_type even with flags on and owner role', () => {
    setMe({ role: 'owner', userType: 'client' });
    setFlags(['CLOSE_REVIEW_V1', 'CLIENT_PORTAL_V1']);
    const { container } = renderRoute(<PracticeGroup />);
    expect(container.querySelector('[data-testid="practice-group"]')).toBeNull();
  });

  it('renders nothing for readonly role', () => {
    setMe({ role: 'readonly' });
    setFlags(['CLOSE_REVIEW_V1']);
    const { container } = renderRoute(<PracticeGroup />);
    expect(container.querySelector('[data-testid="practice-group"]')).toBeNull();
  });

  it('renders Practice group with Close Review for bookkeeper when flag on', () => {
    setMe({ role: 'bookkeeper' });
    setFlags(['CLOSE_REVIEW_V1']);
    renderRoute(<PracticeGroup />);
    expect(screen.getByTestId('practice-group')).toBeInTheDocument();
    expect(screen.getByText('Close Review')).toBeInTheDocument();
  });

  it('shows Client Portal + Reminders for bookkeeper (now staff-editable)', () => {
    setMe({ role: 'bookkeeper' });
    setFlags(['CLOSE_REVIEW_V1', 'CLIENT_PORTAL_V1', 'REMINDERS_V1']);
    renderRoute(<PracticeGroup />);
    expect(screen.getByText('Close Review')).toBeInTheDocument();
    // Client Portal + Reminders were lowered to bookkeeper-tier so firm
    // staff can manage them.
    expect(screen.getByText('Client Portal')).toBeInTheDocument();
    expect(screen.getByText('Reminders')).toBeInTheDocument();
  });

  it('renders nothing for a bare owner with no firm membership (self-signup client)', () => {
    setMe({ role: 'owner' });
    setFirmMembership(false);
    setFlags(['CLOSE_REVIEW_V1', 'CLIENT_PORTAL_V1']);
    const { container } = renderRoute(<PracticeGroup />);
    expect(container.querySelector('[data-testid="practice-group"]')).toBeNull();
  });

  it('shows owner-tier items for a firm-member owner with flags on', () => {
    setMe({ role: 'owner' });
    setFirmMembership(true);
    setFlags(['CLIENT_PORTAL_V1', 'REMINDERS_V1']);
    renderRoute(<PracticeGroup />);
    expect(screen.getByText('Client Portal')).toBeInTheDocument();
    expect(screen.getByText('Reminders')).toBeInTheDocument();
  });

  it('hides all items when flags are disabled, even for owner', () => {
    setMe({ role: 'owner' });
    setFirmMembership(true);
    setFlags([]);
    const { container } = renderRoute(<PracticeGroup />);
    // showGroup is false when no items pass — group not rendered.
    expect(container.querySelector('[data-testid="practice-group"]')).toBeNull();
  });

  it('renders both Close Cycle and Client Communication dividers when mixed items visible', () => {
    setMe({ role: 'owner' });
    setFirmMembership(true);
    setFlags(['CLOSE_REVIEW_V1', 'CLIENT_PORTAL_V1']);
    renderRoute(<PracticeGroup />);
    expect(screen.getByText('Close Cycle')).toBeInTheDocument();
    expect(screen.getByText('Client Communication')).toBeInTheDocument();
  });

  it('has aria-expanded on the toggle button', () => {
    setMe({ role: 'owner' });
    setFirmMembership(true);
    setFlags(['CLOSE_REVIEW_V1']);
    renderRoute(<PracticeGroup />);
    const button = screen.getByRole('button', { name: /Collapse Practice menu|Expand Practice menu/ });
    expect(button).toHaveAttribute('aria-expanded');
  });
});
