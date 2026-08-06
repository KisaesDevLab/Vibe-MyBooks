// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Trial Balance sidebar group (TB module). Mirrors PracticeGroup:
// self-gating (DOM-absent unless the flag + staff role allow it), own
// collapse key, rendered from Sidebar's group loop next to Practice.

import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  ChevronDown,
  Scale,
  Table2,
  GitBranch,
  BookOpenCheck,
  FilePlus2,
  Calculator,
  FileBarChart2,
  Download,
  Settings2,
} from 'lucide-react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { useTrialBalanceVisibility, type TbNavItem } from '../../hooks/useTrialBalanceVisibility';

const TB_COLLAPSED_STORAGE_KEY = 'tb-group-collapsed';

const ICONS: Record<string, LucideIcon> = {
  'workpaper': Table2,
  'mapping': GitBranch,
  'leadsheets': BookOpenCheck,
  'tax-entries': FilePlus2,
  'm1': Calculator,
  'reports': FileBarChart2,
  'exports': Download,
  'settings': Settings2,
};

function readInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(TB_COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function TbLink({ item, onClick }: { item: TbNavItem; onClick?: () => void }) {
  const Icon = ICONS[item.key] ?? Scale;
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

export function TrialBalanceGroup({ onNavigate }: { onNavigate?: () => void }) {
  const { ready, showGroup, items } = useTrialBalanceVisibility();
  const [collapsed, setCollapsed] = useState<boolean>(() => readInitialCollapsed());

  useEffect(() => {
    try {
      localStorage.setItem(TB_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // Ignore quota / privacy-mode errors.
    }
  }, [collapsed]);

  if (!ready || !showGroup) return null;
  const expanded = !collapsed;

  return (
    <div data-testid="tb-group">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={expanded}
        aria-controls="tb-group-items"
        aria-label={expanded ? 'Collapse Trial Balance menu' : 'Expand Trial Balance menu'}
        className="flex items-center justify-between w-full px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80 transition-opacity"
        style={{ color: '#9CA3AF' }}
      >
        <span>Trial Balance</span>
        <ChevronDown
          className={clsx('h-3.5 w-3.5 transition-transform duration-200', expanded && 'rotate-180')}
        />
      </button>
      {expanded && (
        <div id="tb-group-items">
          {items.map((item) => (
            <TbLink key={item.key} item={item} onClick={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}
