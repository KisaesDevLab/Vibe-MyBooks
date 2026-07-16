// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ArrowLeftRight,
  Plus,
  FileText,
  BarChart3,
  Landmark,
  Settings,
  LogOut,
  Grid3X3,
  Repeat,
  Paperclip,
  ScrollText,
  Tag,
  Package,
  CreditCard,
  PiggyBank,
  PenLine,
  Printer,
  Shield,
  Copy,
  Wallet,
  Wrench,
  ShieldCheck,
  ShieldAlert,
  Building2,
  UsersRound,
  HelpCircle,
  ChevronDown,
  Receipt,
  Banknote,
  RotateCcw,
  Upload,
  ClipboardList,
  Network,
  Cloud,
  Flag,
  FileUp,
  History,
  Store,
  Scale,
  LayoutTemplate,
  KeyRound,
  Activity,
  Sparkles,
  Plug,
  FileSpreadsheet,
  CheckCheck,
  ClipboardCheck,
} from 'lucide-react';
import clsx from 'clsx';
import { useLogout, useMe } from '../../api/hooks/useAuth';
import { SidebarDisplayControls } from './SidebarDisplayControls';
import { CompanySwitcher } from './CompanySwitcher';
import { PracticeGroup } from './PracticeGroup';
import { FirmGroup } from './FirmGroup';
import type { LucideIcon } from 'lucide-react';
import type { ResourceKey } from '@kis-books/shared';
import { usePermissions } from '../../api/hooks/usePermissions';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  // When true the item is hidden from readonly users. Default false
  // (visible to everyone). Used by GL-write features like Bulk Import
  // so a readonly account doesn't see a link that would just redirect
  // back to '/' on click.
  requiresWrite?: boolean;
  // Per-member permission resource. When set, the item is hidden unless
  // the user has at least `view` on it (see usePermissions). Only
  // affects restricted bookkeepers; everyone else resolves to full/view.
  resource?: ResourceKey;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const adminNavItems: NavItem[] = [
  { to: '/admin', label: 'Admin Dashboard', icon: ShieldCheck },
  { to: '/admin/tenants', label: 'Tenants', icon: Building2 },
  { to: '/admin/users', label: 'Users', icon: UsersRound },
  { to: '/admin/coa-templates', label: 'COA Templates', icon: LayoutTemplate },
  { to: '/admin/tfa', label: 'Two-Factor Auth', icon: KeyRound },
  { to: '/admin/security', label: 'Installation Security', icon: Shield },
  { to: '/admin/plaid', label: 'Plaid Config', icon: Landmark },
  { to: '/admin/plaid/connections', label: 'Plaid Monitor', icon: Activity },
  { to: '/admin/ai', label: 'AI Processing', icon: Sparkles },
  { to: '/admin/mcp', label: 'MCP / API', icon: Plug },
  { to: '/admin/tailscale', label: 'Tailscale', icon: Network },
  { to: '/admin/tunnel', label: 'Cloudflare Tunnel', icon: Cloud },
  { to: '/admin/ip-allowlist', label: 'Staff IP Allowlist', icon: ShieldAlert },
  { to: '/admin/feature-flags', label: 'Feature Flags', icon: Flag },
  { to: '/admin/system', label: 'System Settings', icon: Wrench },
];

const navGroups: NavGroup[] = [
  {
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Transactions',
    items: [
      { to: '/registers', label: 'Registers', icon: ScrollText, resource: 'transactions' },
      { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight, resource: 'transactions' },
      { to: '/transactions/batch', label: 'Batch Entry', icon: Grid3X3, resource: 'batch_entry' },
      // Lands on the ENTRY screen (fill in this period's amounts) — the
      // everyday task; the template builder is one click away via
      // "Manage templates".
      { to: '/transactions/journal-templates/enter', label: 'Journal Templates', icon: LayoutTemplate, resource: 'transactions' },
      { to: '/recurring', label: 'Recurring', icon: Repeat, resource: 'recurring' },
      { to: '/duplicates', label: 'Duplicates', icon: Copy, resource: 'duplicates' },
      // Bulk historical-data import (CoA / contacts / TB / GL from
      // Accounting Power or QuickBooks Online). Visible to any
      // non-readonly staff — see StaffWriteRoute. Moved here from the
      // Admin section because the gate is no longer super-admin only.
      { to: '/imports', label: 'Bulk Import', icon: Upload, requiresWrite: true, resource: 'bulk_import' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/invoices', label: 'Invoices', icon: FileText, resource: 'invoices' },
      { to: '/receive-payment', label: 'Receive Payment', icon: CreditCard, resource: 'receive_payment' },
      { to: '/banking/deposit', label: 'Bank Deposit', icon: PiggyBank, resource: 'banking' },
      { to: '/daily-sales', label: 'Daily Sales (POS)', icon: Store, resource: 'daily_sales' },
      { to: '/items', label: 'Items', icon: Package, resource: 'items' },
    ],
  },
  {
    label: 'Payables',
    items: [
      { to: '/bills', label: 'Bills', icon: Receipt, resource: 'bills' },
      { to: '/pay-bills', label: 'Pay Bills', icon: Banknote, resource: 'pay_bills' },
      { to: '/vendor-credits', label: 'Vendor Credits', icon: RotateCcw, resource: 'vendor_credits' },
    ],
  },
  {
    label: 'Payroll',
    items: [
      { to: '/payroll/import', label: 'Import Payroll', icon: FileSpreadsheet, resource: 'payroll_import' },
      { to: '/payroll/imports', label: 'Import History', icon: ClipboardList, resource: 'payroll_import' },
    ],
  },
  {
    label: 'Checks',
    items: [
      { to: '/checks/write', label: 'Write Check', icon: PenLine, resource: 'checks' },
      { to: '/checks/print', label: 'Print Checks', icon: Printer, resource: 'checks' },
    ],
  },
  {
    label: 'Banking',
    items: [
      { to: '/banking', label: 'Banking', icon: Landmark, resource: 'banking' },
      { to: '/banking/statement-upload', label: 'Import Statement', icon: FileUp, resource: 'banking' },
      { to: '/banking/statement-imports', label: 'Statement Processing', icon: History, resource: 'banking' },
      { to: '/banking/reconcile', label: 'Reconcile', icon: CheckCheck, resource: 'banking' },
      { to: '/banking/reconciliation-history', label: 'Reconcile History', icon: ClipboardCheck, resource: 'banking' },
    ],
  },
  {
    label: 'Reporting',
    items: [
      { to: '/reports', label: 'Reports', icon: BarChart3, resource: 'reports' },
      { to: '/budgets', label: 'Budgets', icon: Wallet, resource: 'budgets' },
      { to: '/budgets/vs-actuals', label: 'Budget vs. Actuals', icon: Scale, resource: 'budgets' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/accounts', label: 'Chart of Accounts', icon: BookOpen, resource: 'accounts' },
      { to: '/contacts', label: 'Contacts', icon: Users, resource: 'contacts' },
      { to: '/attachments', label: 'Attachments', icon: Paperclip, resource: 'attachments' },
      { to: '/settings/tags', label: 'Tags', icon: Tag, resource: 'tags' },
      { to: '/settings', label: 'Settings', icon: Settings },
      { to: '/help', label: 'Knowledge Base', icon: HelpCircle },
    ],
  },
];

function SidebarLink({ item, end, onClick, collapsed }: { item: NavItem; end?: boolean; onClick?: () => void; collapsed?: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={end}
      onClick={onClick}
      // Collapsed rail: icon-only, centered, with the label surfaced via
      // title (hover tooltip) + aria-label (screen readers).
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        clsx(
          'flex items-center rounded-lg text-sm font-medium transition-colors',
          collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2',
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
      <item.icon className="h-5 w-5 shrink-0" />
      {!collapsed && item.label}
    </NavLink>
  );
}

function AdminSection({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {collapsed ? (
        // Rail mode: the section toggle shrinks to an icon-only button
        // (ShieldCheck mirrors the Admin Dashboard entry).
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          title="Admin"
          aria-label="Admin"
          className="flex items-center justify-center w-full px-2 py-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
          style={{ color: '#9CA3AF' }}
        >
          <ShieldCheck className="h-5 w-5" />
        </button>
      ) : (
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80 transition-opacity"
          style={{ color: '#9CA3AF' }}
        >
          <span>Admin</span>
          <ChevronDown
            className={clsx('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
      )}
      {open && (
        <>
          {adminNavItems.map((item) => (
            <SidebarLink key={item.to} item={item} end={item.to === '/admin'} onClick={onNavigate} collapsed={collapsed} />
          ))}
        </>
      )}
      <div className="my-2" style={{ borderBottom: '1px solid #374151' }} />
    </>
  );
}

const newTxnOptions = [
  { label: 'Expense', path: '/transactions/new/expense' },
  { label: 'Bill', path: '/bills/new' },
  { label: 'Vendor Credit', path: '/vendor-credits/new' },
  { label: 'Pay Bills', path: '/pay-bills' },
  { label: 'Deposit', path: '/transactions/new/deposit' },
  { label: 'Transfer', path: '/transactions/new/transfer' },
  { label: 'Cash Sale', path: '/transactions/new/cash-sale' },
  { label: 'Invoice', path: '/invoices/new' },
  { label: 'Write Check', path: '/checks/write' },
  { label: 'Journal Entry', path: '/transactions/new/journal-entry' },
];

function NewTransactionButton({ collapsed }: { collapsed?: boolean }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.top, left: rect.right + 4 });
    }
    setOpen(!open);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleClick}
        title={collapsed ? 'New Transaction' : undefined}
        aria-label={collapsed ? 'New Transaction' : undefined}
        className={clsx(
          'flex items-center w-full rounded-lg text-sm font-medium transition-colors',
          collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2',
        )}
        style={{ color: '#D1D5DB' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1F2937'; e.currentTarget.style.color = '#FFFFFF'; }}
        onMouseLeave={(e) => { if (!open) { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = '#D1D5DB'; } }}
      >
        <Plus className="h-5 w-5 shrink-0" />
        {!collapsed && 'New Transaction'}
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="w-48 bg-white rounded-lg border border-gray-200 shadow-lg py-1"
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
        >
          {newTxnOptions.map((opt) => (
            <button
              key={opt.path}
              onClick={() => { navigate(opt.path); setOpen(false); }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {opt.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

const COLLAPSED_GROUPS_STORAGE_KEY = 'sidebar-collapsed-groups';

// First-view defaults: every labeled group starts collapsed *except*
// Transactions, which is the most common entry point. Once the user
// toggles a group, their preference is persisted to localStorage and
// these defaults no longer apply.
const DEFAULT_COLLAPSED_GROUPS: Record<string, boolean> = {
  Sales: true,
  Payables: true,
  Payroll: true,
  Checks: true,
  Banking: true,
  Reporting: true,
  Manage: true,
};

function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_GROUPS_STORAGE_KEY);
      return stored ? (JSON.parse(stored) as Record<string, boolean>) : { ...DEFAULT_COLLAPSED_GROUPS };
    } catch {
      return { ...DEFAULT_COLLAPSED_GROUPS };
    }
  });

  const toggle = (label: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try {
        localStorage.setItem(COLLAPSED_GROUPS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore quota / privacy-mode errors
      }
      return next;
    });
  };

  return { collapsed, toggle };
}

const DEFAULT_APP_NAME = 'Vibe MyBooks';

// `collapsed` renders the desktop icons-only rail: nav items show just
// their icon (label via title/aria-label), section headings and the
// composite widgets (company switcher, practice/firm groups, display
// controls) are hidden, and every nav item stays reachable because the
// rail ignores the per-group collapse state. The mobile drawer always
// receives collapsed={false} (see AppShell).
export function Sidebar({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const logout = useLogout();
  const { data: meData } = useMe();
  const isSuperAdmin = meData?.user?.isSuperAdmin === true;
  const userRole = meData?.user?.role;
  const isAccountantRole = userRole === 'accountant' || userRole === 'bookkeeper';
  const { can } = usePermissions();
  const { collapsed: collapsedGroups, toggle: toggleGroup } = useCollapsedGroups();
  // Branding may be missing during the initial /me fetch — fall back to
  // the default name so the header never flashes empty.
  const appName = meData?.branding?.appName || DEFAULT_APP_NAME;
  const isCustomAppName = meData?.branding?.isCustomName === true;

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        window.location.href = `${import.meta.env.BASE_URL}login`;
      },
    });
  };

  return (
    <aside className="flex flex-col w-full h-full min-h-screen" style={{ backgroundColor: '#111827', color: '#D1D5DB' }}>
      {collapsed ? (
        // Rail header: first letter of the app name as a compact mark.
        <div className="py-5 text-center" style={{ borderBottom: '1px solid #374151' }} title={appName}>
          <h1 className="text-xl font-bold" style={{ color: '#FFFFFF' }}>{appName.charAt(0)}</h1>
        </div>
      ) : (
        <div className="px-6 py-5" style={{ borderBottom: '1px solid #374151' }}>
          <h1 className="text-xl font-bold" style={{ color: '#FFFFFF' }}>{appName}</h1>
        </div>
      )}

      {!collapsed && <CompanySwitcher />}

      {!collapsed && isAccountantRole && (
        <div className="mx-3 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium text-center"
          style={{ backgroundColor: '#312E81', color: '#C4B5FD' }}>
          {userRole === 'bookkeeper' ? 'Bookkeeper' : 'Accountant'} View
        </div>
      )}

      <nav className={clsx('flex-1 py-4 space-y-0.5 overflow-y-auto', collapsed ? 'px-2' : 'px-3')}>
        {isSuperAdmin && (
          <AdminSection onNavigate={onNavigate} collapsed={collapsed} />
        )}

        {navGroups.map((group, gi) => {
          const isCollapsed = group.label ? collapsedGroups[group.label] === true : false;
          // Rail mode has no group headers, so honoring the per-group
          // collapse state would strand items with no way to reach
          // them — the rail always shows every (permitted) item.
          const expanded = collapsed || !isCollapsed;
          return (
            <div key={gi}>
              {group.label && !collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label!)}
                  aria-expanded={expanded}
                  className="flex items-center justify-between w-full px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ color: '#9CA3AF' }}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={clsx('h-3.5 w-3.5 transition-transform duration-200', expanded && 'rotate-180')}
                  />
                </button>
              )}
              {/* Rail: thin divider stands in for the hidden heading. */}
              {group.label && collapsed && (
                <div className="my-2 mx-2" style={{ borderBottom: '1px solid #374151' }} />
              )}
              {expanded && (
                <>
                  {group.label === 'Transactions' && <NewTransactionButton collapsed={collapsed} />}
                  {group.items
                    // requiresWrite items hide from readonly accounts —
                    // the StaffWriteRoute gate would redirect them away
                    // anyway, but seeing a link that won't work is worse
                    // UX than not seeing it at all.
                    .filter((item) => !(item.requiresWrite && userRole === 'readonly'))
                    // Hide any resource the user can't even view (a
                    // restricted bookkeeper). can() fails open when the
                    // permission map is absent, so nothing regresses.
                    .filter((item) => !item.resource || can(item.resource))
                    .map((item) => (
                      <SidebarLink
                        key={item.to}
                        item={item}
                        end={item.to === '/' || item.to === '/settings'}
                        onClick={onNavigate}
                        collapsed={collapsed}
                      />
                    ))}
                </>
              )}
              {/* Practice group sits between Reporting and Manage
                  per VIBE_MYBOOKS_PRACTICE_BUILD_PLAN sidebar spec.
                  It self-gates by role + user_type + flags, so this
                  unconditional render just positions it — nothing
                  is rendered for staff/readonly or client users.
                  Hidden on the collapsed rail (composite widget with
                  its own headings/toggles); expand the sidebar to
                  reach it. */}
              {group.label === 'Reporting' && !collapsed && <PracticeGroup onNavigate={onNavigate} />}
              {/* 3-tier rules plan, Phase 1 — Firm sidebar entry.
                  Self-gates on `useFirms()` returning a non-empty
                  list, so non-firm users never see the link. Sits
                  below Practice on the same hierarchy level. */}
              {group.label === 'Reporting' && !collapsed && <FirmGroup onNavigate={onNavigate} />}
            </div>
          );
        })}
      </nav>

      {!collapsed && <SidebarDisplayControls />}

      <div className={clsx('py-3', collapsed ? 'px-2' : 'px-3')} style={{ borderTop: '1px solid #374151' }}>
        <button
          onClick={handleLogout}
          title={collapsed ? 'Log out' : undefined}
          aria-label={collapsed ? 'Log out' : undefined}
          className={clsx(
            'flex items-center w-full rounded-lg text-sm font-medium transition-colors',
            collapsed ? 'justify-center px-2 py-2' : 'gap-3 px-3 py-2',
          )}
          style={{ color: '#D1D5DB' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1F2937'; e.currentTarget.style.color = '#FFFFFF'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = '#D1D5DB'; }}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && 'Log out'}
        </button>
        {!collapsed && isCustomAppName && (
          <div className="mt-2 px-3 text-center text-[11px]" style={{ color: '#6B7280' }}>
            powered by{' '}
            <a
              href="https://www.vibemyfirm.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: '#9CA3AF' }}
            >
              VibeMyFirm
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}
