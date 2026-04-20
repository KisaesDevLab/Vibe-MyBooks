// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

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
} from 'lucide-react';
import clsx from 'clsx';
import { useLogout, useMe } from '../../api/hooks/useAuth';
import { SidebarDisplayControls } from './SidebarDisplayControls';
import { CompanySwitcher } from './CompanySwitcher';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const adminNavItems: NavItem[] = [
  { to: '/admin', label: 'Admin Dashboard', icon: ShieldCheck },
  { to: '/admin/tenants', label: 'Tenants', icon: Building2 },
  { to: '/admin/users', label: 'Users', icon: UsersRound },
  { to: '/admin/bank-rules', label: 'Global Bank Rules', icon: Shield },
  { to: '/admin/coa-templates', label: 'COA Templates', icon: BookOpen },
  { to: '/admin/tfa', label: 'Two-Factor Auth', icon: Shield },
  { to: '/admin/security', label: 'Installation Security', icon: Shield },
  { to: '/admin/plaid', label: 'Plaid Config', icon: Landmark },
  { to: '/admin/plaid/connections', label: 'Plaid Monitor', icon: Landmark },
  { to: '/admin/ai', label: 'AI Processing', icon: Shield },
  { to: '/admin/mcp', label: 'MCP / API', icon: Shield },
  { to: '/admin/tailscale', label: 'Tailscale', icon: Network },
  { to: '/admin/tunnel', label: 'Cloudflare Tunnel', icon: Network },
  { to: '/admin/ip-allowlist', label: 'Staff IP Allowlist', icon: ShieldAlert },
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
      { to: '/registers', label: 'Registers', icon: ScrollText },
      { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
      { to: '/transactions/batch', label: 'Batch Entry', icon: Grid3X3 },
      { to: '/recurring', label: 'Recurring', icon: Repeat },
      { to: '/duplicates', label: 'Duplicates', icon: Copy },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/invoices', label: 'Invoices', icon: FileText },
      { to: '/receive-payment', label: 'Receive Payment', icon: CreditCard },
      { to: '/items', label: 'Items', icon: Package },
    ],
  },
  {
    label: 'Payables',
    items: [
      { to: '/bills', label: 'Bills', icon: Receipt },
      { to: '/pay-bills', label: 'Pay Bills', icon: Banknote },
      { to: '/vendor-credits', label: 'Vendor Credits', icon: RotateCcw },
    ],
  },
  {
    label: 'Payroll',
    items: [
      { to: '/payroll/import', label: 'Import Payroll', icon: Upload },
      { to: '/payroll/imports', label: 'Import History', icon: ClipboardList },
    ],
  },
  {
    label: 'Checks',
    items: [
      { to: '/checks/write', label: 'Write Check', icon: PenLine },
      { to: '/checks/print', label: 'Print Checks', icon: Printer },
    ],
  },
  {
    label: 'Banking',
    items: [
      { to: '/banking', label: 'Banking', icon: Landmark },
      { to: '/banking/statement-upload', label: 'Import Statement', icon: FileText },
      { to: '/banking/rules', label: 'Bank Rules', icon: Shield },
      { to: '/banking/deposit', label: 'Bank Deposit', icon: PiggyBank },
    ],
  },
  {
    label: 'Reporting',
    items: [
      { to: '/reports', label: 'Reports', icon: BarChart3 },
      { to: '/budgets', label: 'Budgets', icon: Wallet },
      { to: '/budgets/vs-actuals', label: 'Budget vs. Actuals', icon: Wallet },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/accounts', label: 'Chart of Accounts', icon: BookOpen },
      { to: '/contacts', label: 'Contacts', icon: Users },
      { to: '/attachments', label: 'Attachments', icon: Paperclip },
      { to: '/settings/tags', label: 'Tags', icon: Tag },
      { to: '/settings', label: 'Settings', icon: Settings },
      { to: '/help', label: 'Knowledge Base', icon: HelpCircle },
    ],
  },
];

function SidebarLink({ item, end, onClick }: { item: NavItem; end?: boolean; onClick?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={end}
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
      <item.icon className="h-5 w-5" />
      {item.label}
    </NavLink>
  );
}

function AdminSection({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:opacity-80 transition-opacity"
        style={{ color: '#9CA3AF' }}
      >
        <span>Admin</span>
        <ChevronDown
          className={clsx('h-3.5 w-3.5 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && (
        <>
          {adminNavItems.map((item) => (
            <SidebarLink key={item.to} item={item} end={item.to === '/admin'} onClick={onNavigate} />
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

function NewTransactionButton() {
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
        className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors"
        style={{ color: '#D1D5DB' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1F2937'; e.currentTarget.style.color = '#FFFFFF'; }}
        onMouseLeave={(e) => { if (!open) { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = '#D1D5DB'; } }}
      >
        <Plus className="h-5 w-5" />
        New Transaction
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

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const logout = useLogout();
  const { data: meData } = useMe();
  const isSuperAdmin = meData?.user?.isSuperAdmin === true;
  const userRole = meData?.user?.role;
  const isAccountantRole = userRole === 'accountant' || userRole === 'bookkeeper';
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
    <aside className="flex flex-col w-64 h-full min-h-screen" style={{ backgroundColor: '#111827', color: '#D1D5DB' }}>
      <div className="px-6 py-5" style={{ borderBottom: '1px solid #374151' }}>
        <h1 className="text-xl font-bold" style={{ color: '#FFFFFF' }}>{appName}</h1>
      </div>

      <CompanySwitcher />

      {isAccountantRole && (
        <div className="mx-3 mt-2 px-3 py-1.5 rounded-lg text-xs font-medium text-center"
          style={{ backgroundColor: '#312E81', color: '#C4B5FD' }}>
          {userRole === 'bookkeeper' ? 'Bookkeeper' : 'Accountant'} View
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {isSuperAdmin && (
          <AdminSection onNavigate={onNavigate} />
        )}

        {navGroups.map((group, gi) => {
          const isCollapsed = group.label ? collapsedGroups[group.label] === true : false;
          const expanded = !isCollapsed;
          return (
            <div key={gi}>
              {group.label && (
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
              {expanded && (
                <>
                  {group.label === 'Transactions' && <NewTransactionButton />}
                  {group.items.map((item) => (
                    <SidebarLink
                      key={item.to}
                      item={item}
                      end={item.to === '/' || item.to === '/settings'}
                      onClick={onNavigate}
                    />
                  ))}
                </>
              )}
            </div>
          );
        })}
      </nav>

      <SidebarDisplayControls />

      <div className="px-3 py-3" style={{ borderTop: '1px solid #374151' }}>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ color: '#D1D5DB' }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1F2937'; e.currentTarget.style.color = '#FFFFFF'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ''; e.currentTarget.style.color = '#D1D5DB'; }}
        >
          <LogOut className="h-5 w-5" />
          Log out
        </button>
        {isCustomAppName && (
          <div className="mt-2 px-3 text-center text-[11px]" style={{ color: '#6B7280' }}>
            powered by{' '}
            <a
              href="https://VibeMB.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
              style={{ color: '#9CA3AF' }}
            >
              VibeMB.com
            </a>
          </div>
        )}
      </div>
    </aside>
  );
}
