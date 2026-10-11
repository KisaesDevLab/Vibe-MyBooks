// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Tax Estimator sidebar group (features/tax-estimator). Mirrors TaxEstimatorGroup:
// self-gating (DOM-absent unless the flag + staff role allow it), own
// collapse key, rendered from Sidebar's group loop next to Practice.

import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ChevronDown, Calculator, Users } from 'lucide-react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { useTaxEstimatorVisibility, type TaxEstimatorNavItem } from '../../hooks/useTaxEstimatorVisibility';
import { useSidebarCollapseAll } from './sidebarEvents';

const TE_COLLAPSED_STORAGE_KEY = 'tax-estimator-group-collapsed';

const ICONS: Record<string, LucideIcon> = {
  'taxpayers': Users,
};

function readInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(TE_COLLAPSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function TeLink({ item, onClick }: { item: TaxEstimatorNavItem; onClick?: () => void }) {
  const Icon = ICONS[item.key] ?? Calculator;
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

export function TaxEstimatorGroup({ onNavigate }: { onNavigate?: () => void }) {
  const { ready, showGroup, items } = useTaxEstimatorVisibility();
  const [collapsed, setCollapsed] = useState<boolean>(() => readInitialCollapsed());
  useSidebarCollapseAll(() => setCollapsed(true));

  useEffect(() => {
    try {
      localStorage.setItem(TE_COLLAPSED_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // Ignore quota / privacy-mode errors.
    }
  }, [collapsed]);

  if (!ready || !showGroup) return null;
  const expanded = !collapsed;

  return (
    <div data-testid="tax-estimator-group">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={expanded}
        aria-controls="tax-estimator-group-items"
        aria-label={expanded ? 'Collapse Tax Estimator menu' : 'Expand Tax Estimator menu'}
        className="flex items-center justify-between w-full px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80 transition-opacity"
        style={{ color: '#9CA3AF' }}
      >
        <span>Tax Estimator</span>
        <ChevronDown
          className={clsx('h-3.5 w-3.5 transition-transform duration-200', expanded && 'rotate-180')}
        />
      </button>
      {expanded && (
        <div id="tax-estimator-group-items">
          {items.map((item) => (
            <TeLink key={item.key} item={item} onClick={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}
