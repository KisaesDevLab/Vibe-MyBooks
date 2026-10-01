// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Form pieces shared by the standing-rule editor and the one-off
// "New request" form: document-type labels, the staff-notify picker and
// the bank / card statement routing select.

import { useEffect, useState } from 'react';
import type { DocumentType, StatementRoutingMode } from '@kis-books/shared';
import { api } from './RemindersPage';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  bank_statement: 'Bank statement',
  cc_statement: 'Credit-card statement',
  payroll_report: 'Payroll report',
  receipt_batch: 'Receipt batch',
  sales_tax_report: 'Sales tax report',
  accounts_receivable: 'Accounts receivable',
  inventory: 'Inventory',
  accounts_payable: 'Accounts payable',
  loan_balance: 'Loan balance',
  other: 'Other',
};

export function isStatementType(t: DocumentType): boolean {
  return t === 'bank_statement' || t === 'cc_statement';
}

// Sentinel value for the routing dropdown: "parse now, review on the
// Statement Processing page" (statement_routing = 'statement_processing').
export const ROUTE_TO_STATEMENT_PROCESSING = '__statement_processing';

/** The routing dropdown's value → the API's statementRouting + bankConnectionId. */
export function routingPayload(choice: string): { statementRouting: StatementRoutingMode; bankConnectionId: string | null } {
  return {
    statementRouting:
      choice === ROUTE_TO_STATEMENT_PROCESSING ? 'statement_processing'
      : choice ? 'auto_import'
      : 'inbox',
    bankConnectionId: choice && choice !== ROUTE_TO_STATEMENT_PROCESSING ? choice : null,
  };
}

interface BankConnectionOption {
  id: string;
  institutionName: string | null;
  mask: string | null;
  companyId: string | null;
}

/** The firm's bank connections for the routing picker (only fetched when enabled). */
export function useBankConnectionOptions(enabled: boolean | undefined): BankConnectionOption[] {
  const [connections, setConnections] = useState<BankConnectionOption[]>([]);
  useEffect(() => {
    if (!enabled) return;
    void api<{ connections: BankConnectionOption[] }>('/practice/bank-connections')
      .then((r) => setConnections(r.connections))
      .catch(() => setConnections([]));
  }, [enabled]);
  return connections;
}

export function StatementRoutingSelect({
  value,
  onChange,
  connections,
  subject,
}: {
  value: string;
  onChange: (v: string) => void;
  connections: BankConnectionOption[];
  /** "this rule" / "this request" — used in the help line. */
  subject: string;
}) {
  return (
    <label className="block text-sm">
      <span className="block text-gray-800 mb-1">When the statement arrives</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
      >
        <option value="">Receipts inbox — pick a bank connection manually</option>
        <option value={ROUTE_TO_STATEMENT_PROCESSING}>
          Statement Processing — parse now, review &amp; import there
        </option>
        {connections.map((c) => (
          <option key={c.id} value={c.id}>
            Auto-import: {c.institutionName ?? 'Bank connection'}
            {c.mask ? ` ····${c.mask}` : ''}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500 mt-1">
        {value === ROUTE_TO_STATEMENT_PROCESSING
          ? 'The PDF is parsed on arrival and appears on Banking → Statement Processing as pending review — you pick the account and import from there.'
          : value
            ? `Uploads against ${subject} are parsed and imported as bank-feed items directly (held for review if the parse quality check fails).`
            : 'Uploads wait in the receipts inbox until you route each one to a bank connection.'}
      </p>
    </label>
  );
}

// Staff users offered in the "notify when the client submits" picker.
// /company/users is the Team page's list (everyone with access to this
// tenant); client-type and inactive users are filtered out client-side
// and rejected server-side too.
export interface StaffUserOption {
  id: string;
  email: string;
  displayName: string | null;
  userType: 'staff' | 'client';
  isActive: boolean;
}

/** null while loading. */
export function useStaffUserOptions(): StaffUserOption[] | null {
  const [staffUsers, setStaffUsers] = useState<StaffUserOption[] | null>(null);
  useEffect(() => {
    void api<{ users: StaffUserOption[] }>('/company/users')
      .then((r) => setStaffUsers(r.users.filter((u) => u.userType === 'staff' && u.isActive)))
      .catch(() => setStaffUsers([]));
  }, []);
  return staffUsers;
}

export function StaffNotifyPicker({
  staffUsers,
  selected,
  onToggle,
}: {
  staffUsers: StaffUserOption[] | null;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset className="block text-sm">
      <legend className="block text-gray-800 mb-1">Email staff when the client submits</legend>
      {staffUsers === null ? (
        <p className="text-xs text-gray-500">Loading team…</p>
      ) : staffUsers.length === 0 ? (
        <p className="text-xs text-gray-500">No active staff users have access to this client.</p>
      ) : (
        <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100">
          {staffUsers.map((u) => (
            <label key={u.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(u.id)}
                onChange={() => onToggle(u.id)}
              />
              <span className="truncate">
                {u.displayName ? `${u.displayName} — ${u.email}` : u.email}
              </span>
            </label>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-500 mt-1">
        Each checked person gets an email the moment the contact uploads against this request.
        The submission also shows as unread on the dashboard and the Clients screen until someone marks it reviewed.
      </p>
    </fieldset>
  );
}

/** Drop selections that no longer match a listed user (deactivated since) so the save doesn't 400. */
export function liveNotifyIds(staffUsers: StaffUserOption[] | null, selected: string[]): string[] {
  return staffUsers ? selected.filter((id) => staffUsers.some((u) => u.id === id)) : selected;
}
