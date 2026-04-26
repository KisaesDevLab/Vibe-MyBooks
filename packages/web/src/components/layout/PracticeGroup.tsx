// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  ChevronDown,
  Briefcase,
  Sparkles,
  Scale,
  Inbox,
  FileText,
  Users,
  Bell,
  LineChart,
} from 'lucide-react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { usePracticeVisibility, type PracticeNavItem } from '../../hooks/usePracticeVisibility';

// Localstorage key for this group's collapsed state — kept separate
// from the SIDEBAR_COLLAPSED_GROUPS_STORAGE_KEY used by the main
// NavGroup loop in Sidebar.tsx. The legacy groups store their state
// as a Record<label, boolean>; this group has its own key so a user
// whose browser pre-dates Phase 1 doesn't see any legacy state
// collide with ours.
const PRACTICE_COLLAPSED_STORAGE_KEY = 'practice-group-collapsed';

const ICONS: Record<string, LucideIcon> = {
  'close-review': Sparkles,
  'rules': Scale,
  'receipts-inbox': Inbox,
  '1099': FileText,
  'client-portal': Users,
  'reminders': Bell,
  'report-builder': LineChart,
};

function readInitialCollapsed(): boolean {
  try {
    const raw = localStorage.getItem(PRACTICE_COLLAPSED_STORAGE_KEY);
    if (raw === null) return false;
    return raw === '1';
  } catch {
    return false;
  }
}

function PracticeLink({ item, onClick }: { item: PracticeNavItem; onClick?: () => void }) {
  const Icon = ICONS[item.key] ?? Briefcase;
  return (
    <NavLink
      to={item.path}
      onClick={onClick}
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
      {item.label}
    </NavLink>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div
      className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider"
      style={{ color: '#6B7280' }}
    >
      {label}
    </div>
  );
}

export function PracticeGroup({ onNavigate }: { onNavigate?: () => void }) {
  const { ready, showGroup, sections } = usePracticeVisibility();
  const [collapsed, setCollapsed] = useState<boolean>(() => readInitialCollapsed());

  useEffect(() => {
    try {
      localStorage.setItem(PRACTICE_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // Ignore quota / privacy-mode errors — the in-memory state
      // still works for the current session.
    }
  }, [collapsed]);

  // Server-side + client-side conditional render: DOM-absent when
  // the user can't access Practice. The build plan explicitly asks
  // for absent-from-DOM rather than CSS-hidden (plan line 192).
  if (!ready) return null;
  if (!showGroup) return null;

  const closeCycle = sections['close-cycle'];
  const clientComm = sections['client-communication'];
  const expanded = !collapsed;

  return (
    <div data-testid="practice-group">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={expanded}
        aria-controls="practice-group-items"
        aria-label={expanded ? 'Collapse Practice menu' : 'Expand Practice menu'}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setCollapsed((c) => !c);
          }
        }}
        className="flex items-center justify-between w-full px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80 transition-opacity"
        style={{ color: '#9CA3AF' }}
      >
        <span>Practice</span>
        <ChevronDown
          className={clsx('h-3.5 w-3.5 transition-transform duration-200', expanded && 'rotate-180')}
        />
      </button>
      {expanded && (
        <div id="practice-group-items">
          {closeCycle.length > 0 && <SectionDivider label="Close Cycle" />}
          {closeCycle.map((item) => (
            <PracticeLink key={item.key} item={item} onClick={onNavigate} />
          ))}
          {clientComm.length > 0 && <SectionDivider label="Client Communication" />}
          {clientComm.map((item) => (
            <PracticeLink key={item.key} item={item} onClick={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}
