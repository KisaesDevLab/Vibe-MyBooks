// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, X, CircleCheck, Landmark, Receipt, Users } from 'lucide-react';

// First-run onboarding prompt shown on the Dashboard when a tenant looks
// fresh (no transactions yet). Gives non-technical users three obvious
// next steps in the app so they don't stare at an empty dashboard
// wondering what to click first.
//
// Three design decisions worth calling out:
//   1. Dismissal is per-user, persisted in localStorage. Clearing cookies
//      in a private-browsing window brings it back — that's fine, it's a
//      tip, not a consent record.
//   2. We don't track which tasks have actually been done server-side.
//      Each item has a `completed` prop the parent passes in based on the
//      existing dashboard signals (bank connections, invoice count, user
//      count) — no new API calls just for this banner.
//   3. The banner fades itself out entirely once all items are done, even
//      without an explicit dismissal, so a returning-never-dismissed user
//      with a fully-populated tenant doesn't keep seeing it forever.

const DISMISS_STORAGE_KEY = 'kisbooks-onboarding-dismissed-v1';

export function isOnboardingDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissOnboarding(): void {
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, '1');
  } catch {
    // localStorage disabled — banner will show again next load, which is
    // fine since the user had already dismissed it once in-session.
  }
}

interface OnboardingBannerProps {
  /** True when at least one bank connection exists or a bank feed is present. */
  hasBanking: boolean;
  /** True when the tenant has created at least one invoice. */
  hasInvoices: boolean;
  /** True when more than one user has access to the tenant. */
  hasTeam: boolean;
}

export function OnboardingBanner({ hasBanking, hasInvoices, hasTeam }: OnboardingBannerProps) {
  const [dismissed, setDismissed] = useState(isOnboardingDismissed());

  if (dismissed) return null;

  const items = [
    {
      key: 'banking',
      done: hasBanking,
      icon: Landmark,
      title: 'Connect a bank account',
      body: 'Pull transactions in automatically instead of typing them one by one.',
      href: '/banking',
      cta: 'Connect',
    },
    {
      key: 'invoice',
      done: hasInvoices,
      icon: Receipt,
      title: 'Create your first invoice',
      body: 'Send a customer invoice (and accept a card payment if you set up Stripe).',
      href: '/invoices/new',
      cta: 'Create',
    },
    {
      key: 'team',
      done: hasTeam,
      icon: Users,
      title: 'Add a team member',
      body: 'Invite a bookkeeper, accountant, or co-owner — each with their own role.',
      href: '/settings/team',
      cta: 'Invite',
    },
  ];

  // If every item is done, drop the banner entirely — the user has graduated.
  if (items.every((i) => i.done)) return null;

  const handleDismiss = () => {
    dismissOnboarding();
    setDismissed(true);
  };

  return (
    <div className="bg-gradient-to-br from-primary-50 to-emerald-50 border border-primary-200 rounded-lg p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary-600 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Get started with Vibe MyBooks</h2>
            <p className="text-xs text-gray-600 mt-0.5">
              A few quick steps to make the app useful for your business. Skip anything you don&apos;t need.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss onboarding tips"
          className="text-gray-400 hover:text-gray-600 flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ul className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.key}
              className={`bg-white rounded-md border p-3 ${
                item.done ? 'border-green-200 opacity-75' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start gap-2 mb-2">
                {item.done ? (
                  <CircleCheck className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <Icon className="h-4 w-4 text-primary-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`text-xs font-medium ${item.done ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                    {item.title}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{item.body}</p>
                </div>
              </div>
              {!item.done && (
                <Link
                  to={item.href}
                  className="text-xs font-medium text-primary-700 hover:text-primary-800 inline-flex items-center gap-0.5"
                >
                  {item.cta} &rarr;
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
