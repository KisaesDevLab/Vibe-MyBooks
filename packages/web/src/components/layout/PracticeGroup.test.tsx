// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

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

vi.mock('../../api/hooks/useAuth', () => ({
  useMe: () => meResult,
}));

vi.mock('../../api/hooks/useFeatureFlag', () => ({
  useFeatureFlags: () => flagsResult,
  useFeatureFlag: () => undefined,
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

  it('does not show owner-tier items for bookkeeper role', () => {
    setMe({ role: 'bookkeeper' });
    setFlags(['CLOSE_REVIEW_V1', 'CLIENT_PORTAL_V1', 'REMINDERS_V1']);
    renderRoute(<PracticeGroup />);
    expect(screen.getByText('Close Review')).toBeInTheDocument();
    expect(screen.queryByText('Client Portal')).toBeNull();
    expect(screen.queryByText('Reminders')).toBeNull();
  });

  it('shows owner-tier items for owner role with flags on', () => {
    setMe({ role: 'owner' });
    setFlags(['CLIENT_PORTAL_V1', 'REMINDERS_V1']);
    renderRoute(<PracticeGroup />);
    expect(screen.getByText('Client Portal')).toBeInTheDocument();
    expect(screen.getByText('Reminders')).toBeInTheDocument();
  });

  it('hides all items when flags are disabled, even for owner', () => {
    setMe({ role: 'owner' });
    setFlags([]);
    const { container } = renderRoute(<PracticeGroup />);
    // showGroup is false when no items pass — group not rendered.
    expect(container.querySelector('[data-testid="practice-group"]')).toBeNull();
  });

  it('renders both Close Cycle and Client Communication dividers when mixed items visible', () => {
    setMe({ role: 'owner' });
    setFlags(['CLOSE_REVIEW_V1', 'CLIENT_PORTAL_V1']);
    renderRoute(<PracticeGroup />);
    expect(screen.getByText('Close Cycle')).toBeInTheDocument();
    expect(screen.getByText('Client Communication')).toBeInTheDocument();
  });

  it('has aria-expanded on the toggle button', () => {
    setMe({ role: 'owner' });
    setFlags(['CLOSE_REVIEW_V1']);
    renderRoute(<PracticeGroup />);
    const button = screen.getByRole('button', { name: /Collapse Practice menu|Expand Practice menu/ });
    expect(button).toHaveAttribute('aria-expanded');
  });
});
