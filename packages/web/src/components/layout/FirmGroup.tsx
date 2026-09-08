// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { NavLink } from 'react-router-dom';
import { Building2, UserPlus } from 'lucide-react';
import clsx from 'clsx';
import { useFirms } from '../../api/hooks/useFirms';

const FIRM_LINKS = [
  { to: '/firm', label: 'Firms', icon: Building2, end: true },
  // "Invite my accountant" — where a staffer types a client's 8-char code.
  { to: '/firm/join', label: 'Join a client', icon: UserPlus, end: false },
] as const;

// 3-tier rules plan, Phase 1 — Firm sidebar entry. DOM-absent
// when the user has no firm membership (the `useFirms` query
// returns an empty list). Mirrors the PracticeGroup absent-from-
// DOM convention rather than CSS-hidden so screen readers and
// keyboard tab order ignore the surface entirely for non-firm
// users.
export function FirmGroup({ onNavigate }: { onNavigate?: () => void }) {
  const { data, isLoading } = useFirms();
  if (isLoading) return null;
  const firms = data?.firms ?? [];
  if (firms.length === 0) return null;

  return (
    <div data-testid="firm-group">
      <div
        className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider"
        style={{ color: '#9CA3AF' }}
      >
        Firm
      </div>
      {FIRM_LINKS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive ? 'sidebar-active' : 'sidebar-item',
            )
          }
          style={({ isActive }) => isActive
            ? { backgroundColor: '#1F2937', color: '#FFFFFF' }
            : { color: '#D1D5DB' }
          }
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            if (!el.classList.contains('sidebar-active')) {
              el.style.backgroundColor = '#1F2937';
              el.style.color = '#FFFFFF';
            }
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            if (!el.classList.contains('sidebar-active')) {
              el.style.backgroundColor = '';
              el.style.color = '#D1D5DB';
            }
          }}
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </div>
  );
}
