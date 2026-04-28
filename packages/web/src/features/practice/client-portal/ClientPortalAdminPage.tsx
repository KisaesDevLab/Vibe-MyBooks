// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useMemo, useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  Pause,
  Play,
  Search,
  Users,
  Settings as SettingsIcon,
  MessageSquare,
  CheckCircle2,
  Send,
  Eye,
  Upload,
} from 'lucide-react';
import { useCompanyContext } from '../../../providers/CompanyProvider';
import {
  usePortalContacts,
  useCreatePortalContact,
  useUpdatePortalContact,
  useDeletePortalContact,
  useSetPortalContactCompanies,
  usePortalContact,
  usePortalPracticeSettings,
  useUpdatePortalPracticeSettings,
  type PortalContactSummary,
  type CreatePortalContactInput,
} from '../../../api/hooks/usePortalContacts';
import {
  useQuestionsList,
  useQuestionDetail,
  useCreateQuestion,
  useBookkeeperReply,
  useResolveQuestion,
  usePendingBatches,
  useMarkBatchNotified,
} from '../../../api/hooks/usePortalQuestions';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { PortalContactDocumentsPanel } from '../reminders/PortalContactDocumentsPanel';

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 8 — bookkeeper-side
// portal contact admin page. Replaces the prior placeholder.

type Tab = 'contacts' | 'questions' | 'settings';

export function ClientPortalAdminPage() {
  const [tab, setTab] = useState<Tab>('contacts');

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Client Portal</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage portal contacts and questions. Contacts can answer questions, upload files, and view reports
            you publish — they don't count against any user license.
          </p>
        </div>
      </header>

      <nav className="border-b border-gray-200 mb-6">
        <div className="flex gap-6">
          <TabButton active={tab === 'contacts'} onClick={() => setTab('contacts')}>
            <Users className="h-4 w-4" /> Contacts
          </TabButton>
          <TabButton active={tab === 'questions'} onClick={() => setTab('questions')}>
            <MessageSquare className="h-4 w-4" /> Questions
          </TabButton>
          <TabButton active={tab === 'settings'} onClick={() => setTab('settings')}>
            <SettingsIcon className="h-4 w-4" /> Settings
          </TabButton>
        </div>
      </nav>

      {tab === 'contacts' ? <ContactsTab /> : tab === 'questions' ? <QuestionsTab /> : <SettingsTab />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 pb-3 -mb-px text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'border-indigo-600 text-indigo-700'
          : 'border-transparent text-gray-600 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  );
}

// ── Contacts tab ─────────────────────────────────────────────────

function ContactsTab() {
  const [statusFilter, setStatusFilter] = useState<'active' | 'paused' | 'all'>('active');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const { data, isLoading, isError } = usePortalContacts({ status: statusFilter });
  const contacts = data?.contacts ?? [];

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.trim().toLowerCase();
    return contacts.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        (c.firstName ?? '').toLowerCase().includes(q) ||
        (c.lastName ?? '').toLowerCase().includes(q),
    );
  }, [contacts, search]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'active' | 'paused' | 'all')}
          className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="all">All</option>
        </select>
        <ImportCsvButton />
        <button
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md"
        >
          <Plus className="h-4 w-4" /> Add Contact
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : isError ? (
        <ErrorBox message="Failed to load contacts." />
      ) : filtered.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} hasSearch={!!search.trim()} />
      ) : (
        <ContactsTable
          contacts={filtered}
          onEdit={setEditId}
        />
      )}

      {showAdd && <AddContactModal onClose={() => setShowAdd(false)} />}
      {editId && <EditContactModal contactId={editId} onClose={() => setEditId(null)} />}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="p-4 border border-red-200 bg-red-50 rounded-md text-sm text-red-700">
      {message} <button className="underline" onClick={() => window.location.reload()}>Retry</button>
    </div>
  );
}

function EmptyState({ onAdd, hasSearch }: { onAdd: () => void; hasSearch: boolean }) {
  if (hasSearch) {
    return (
      <div className="text-center py-16 text-gray-500 text-sm">No contacts match your search.</div>
    );
  }
  return (
    <div className="text-center py-16 border border-dashed border-gray-300 rounded-lg">
      <Users className="mx-auto h-10 w-10 text-gray-400 mb-3" />
      <h3 className="text-base font-medium text-gray-900 mb-1">No portal contacts yet</h3>
      <p className="text-sm text-gray-500 mb-4">
        Add a contact and link them to one or more companies to give them portal access.
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md"
      >
        <Plus className="h-4 w-4" /> Add Contact
      </button>
    </div>
  );
}

function FlagToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5"
      />
      <span>{label}</span>
    </label>
  );
}

function ImportCsvButton() {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setBusy(true);
    setResult(null);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      // Skip header if first row's first column is "email" (case-insensitive).
      const startIdx = lines[0]?.split(',')[0]?.trim().toLowerCase() === 'email' ? 1 : 0;
      const rows = lines.slice(startIdx).map((line) => {
        const cells = line.split(',').map((c) => c.trim());
        const [email, phone, firstName, lastName, companyIdsRaw, role] = cells;
        const companyIds = (companyIdsRaw ?? '')
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean);
        return {
          email: email ?? '',
          phone: phone || undefined,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          companyIds,
          role: role || undefined,
        };
      });

      const token = localStorage.getItem('accessToken');
      const res = await fetch('/api/v1/practice/portal/contacts/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({ rows }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { inserted: number; linked: number; skipped: { email: string; reason: string }[] };
      setResult(
        `Imported ${data.inserted} new, linked ${data.linked} existing. ${data.skipped.length} skipped.`,
      );
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  };

  return (
    <>
      <button
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-100 px-3 py-2 rounded-md disabled:opacity-50"
        title="Import contacts from CSV (columns: email,phone,first,last,company_ids;-delimited,role)"
      >
        <Upload className="h-4 w-4" /> {busy ? 'Importing…' : 'Import CSV'}
      </button>
      <input
        ref={ref}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      {result && (
        <span className="text-xs text-gray-600 ml-2">{result}</span>
      )}
    </>
  );
}

function PreviewButton({ contactId }: { contactId: string }) {
  const { data } = usePortalContact(contactId);
  const companies = data?.contact.companies ?? [];
  if (companies.length === 0) return null;
  const first = companies[0]!;
  return (
    <button
      title={`Preview as this contact at ${first.companyName}`}
      onClick={() => startPreview(contactId, first.companyId)}
      className="p-1.5 rounded hover:bg-indigo-50 text-indigo-600"
    >
      <Eye className="h-4 w-4" />
    </button>
  );
}

async function startPreview(contactId: string, companyId: string): Promise<void> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/v1/practice/portal/preview/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
    },
    credentials: 'include',
    body: JSON.stringify({ contactId, companyId, origin: 'contact_list' }),
  });
  if (!res.ok) {
    alert('Could not start preview — your role may not be allowed.');
    return;
  }
  const data = await res.json();
  // Open the portal in a new tab — the preview cookie is set on this
  // origin and will accompany the new request.
  window.open(data.redirectUrl, '_blank', 'noopener');
}

function ContactsTable({
  contacts,
  onEdit,
}: {
  contacts: PortalContactSummary[];
  onEdit: (id: string) => void;
}) {
  const update = useUpdatePortalContact();
  const remove = useDeletePortalContact();

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-4 py-2 font-medium text-gray-700">Name / Email</th>
            <th className="text-left px-4 py-2 font-medium text-gray-700">Phone</th>
            <th className="text-left px-4 py-2 font-medium text-gray-700">Companies</th>
            <th className="text-left px-4 py-2 font-medium text-gray-700">Status</th>
            <th className="text-left px-4 py-2 font-medium text-gray-700">Last Seen</th>
            <th className="text-right px-4 py-2 font-medium text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {contacts.map((c) => {
            const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email;
            return (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <button onClick={() => onEdit(c.id)} className="text-left hover:underline">
                    <div className="font-medium text-gray-900">{fullName}</div>
                    {(c.firstName || c.lastName) && (
                      <div className="text-xs text-gray-500">{c.email}</div>
                    )}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-700">{c.phone || '—'}</td>
                <td className="px-4 py-3 text-gray-700">{c.companyCount}</td>
                <td className="px-4 py-3">
                  <StatusPill status={c.status} />
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {c.lastSeenAt ? new Date(c.lastSeenAt).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <PreviewButton contactId={c.id} />
                    {c.status === 'active' ? (
                      <button
                        title="Pause"
                        onClick={() => update.mutate({ id: c.id, input: { status: 'paused' } })}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                      >
                        <Pause className="h-4 w-4" />
                      </button>
                    ) : c.status === 'paused' ? (
                      <button
                        title="Resume"
                        onClick={() => update.mutate({ id: c.id, input: { status: 'active' } })}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    ) : null}
                    <button
                      title="Delete"
                      onClick={() => {
                        if (confirm(`Delete contact ${c.email}? Their response history will be retained.`)) {
                          remove.mutate(c.id);
                        }
                      }}
                      className="p-1.5 rounded hover:bg-red-50 text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-50 text-green-700 ring-green-600/20',
    paused: 'bg-yellow-50 text-yellow-700 ring-yellow-600/20',
    deleted: 'bg-gray-100 text-gray-600 ring-gray-400/20',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset ${
        styles[status] ?? styles['deleted']
      }`}
    >
      {status}
    </span>
  );
}

// ── Add modal ─────────────────────────────────────────────────────

function AddContactModal({ onClose }: { onClose: () => void }) {
  const { companies } = useCompanyContext();
  const create = useCreatePortalContact();

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [role, setRole] = useState('staff');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedCompanies.length === 0) {
      setError('Select at least one company.');
      return;
    }

    const input: CreatePortalContactInput = {
      email: email.trim(),
      phone: phone.trim() || null,
      firstName: firstName.trim() || null,
      lastName: lastName.trim() || null,
      companies: selectedCompanies.map((id) => ({ companyId: id, role })),
    };
    try {
      await create.mutateAsync(input);
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Failed to add contact. The email may already be in use.';
      setError(msg);
    }
  };

  return (
    <ModalShell title="Add Portal Contact" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" required>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </Field>
          <Field label="Last name">
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </Field>
        </div>
        <Field label="Phone">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 555 5555"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </Field>
        <Field label="Role">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="owner">Owner</option>
            <option value="controller">Controller</option>
            <option value="bookkeeper-liaison">Bookkeeper liaison</option>
            <option value="staff">Staff</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Companies" required>
          <div className="border border-gray-300 rounded-md max-h-44 overflow-y-auto p-2">
            {companies.length === 0 ? (
              <p className="text-xs text-gray-500 py-2 px-1">No companies in this tenant yet.</p>
            ) : (
              companies.map((c) => (
                <label key={c.id} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedCompanies.includes(c.id)}
                    onChange={(e) => {
                      setSelectedCompanies((prev) =>
                        e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id),
                      );
                    }}
                  />
                  {c.businessName}
                </label>
              ))
            )}
          </div>
        </Field>

        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={create.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50"
          >
            {create.isPending ? 'Adding…' : 'Add contact'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── Edit modal ────────────────────────────────────────────────────

function EditContactModal({ contactId, onClose }: { contactId: string; onClose: () => void }) {
  const { companies } = useCompanyContext();
  const { data, isLoading } = usePortalContact(contactId);
  const update = useUpdatePortalContact();
  const setCos = useSetPortalContactCompanies();

  const contact = data?.contact;
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  // Per-company assignment + access flags. We track the full
  // assignment shape locally so the bookkeeper can grant
  // financials/files/questions-for-us access without leaving the
  // edit modal.
  interface CoAssign {
    companyId: string;
    role: string;
    assignable: boolean;
    financialsAccess: boolean;
    filesAccess: boolean;
    questionsForUsAccess: boolean;
  }
  const [assignments, setAssignments] = useState<CoAssign[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  if (contact && !hydrated) {
    setEmail(contact.email);
    setPhone(contact.phone ?? '');
    setFirstName(contact.firstName ?? '');
    setLastName(contact.lastName ?? '');
    setAssignments(
      contact.companies.map((c) => ({
        companyId: c.companyId,
        role: c.role,
        assignable: c.assignable,
        financialsAccess: c.financialsAccess,
        filesAccess: c.filesAccess,
        questionsForUsAccess: c.questionsForUsAccess,
      })),
    );
    setHydrated(true);
  }

  const isLinked = (id: string) => assignments.some((a) => a.companyId === id);
  const toggleLink = (id: string, on: boolean) => {
    setAssignments((prev) =>
      on
        ? prev.some((a) => a.companyId === id)
          ? prev
          : [
              ...prev,
              {
                companyId: id,
                role: 'staff',
                assignable: true,
                financialsAccess: false,
                filesAccess: true,
                questionsForUsAccess: true,
              },
            ]
        : prev.filter((a) => a.companyId !== id),
    );
  };
  const setFlag = (id: string, key: keyof Omit<CoAssign, 'companyId' | 'role'>, val: boolean) => {
    setAssignments((prev) => prev.map((a) => (a.companyId === id ? { ...a, [key]: val } : a)));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!contact) return;

    if (assignments.length === 0) {
      setError('Contact must be linked to at least one company.');
      return;
    }

    try {
      await update.mutateAsync({
        id: contact.id,
        input: {
          email: email.trim(),
          phone: phone.trim() || null,
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
        },
      });
      // Always send full assignments — server replaces the set.
      await setCos.mutateAsync({
        id: contact.id,
        companies: assignments.map((a) => ({
          companyId: a.companyId,
          role: a.role,
          assignable: a.assignable,
          financialsAccess: a.financialsAccess,
          filesAccess: a.filesAccess,
          questionsForUsAccess: a.questionsForUsAccess,
        })),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes.');
    }
  };

  return (
    <ModalShell title="Edit Portal Contact" onClose={onClose}>
      {isLoading || !contact ? (
        <div className="py-10 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" required>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="First name">
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </Field>
            <Field label="Last name">
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </Field>
          </div>
          <Field label="Phone">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </Field>

          <Field label="Companies & access" required>
            <div className="border border-gray-300 rounded-md max-h-72 overflow-y-auto divide-y divide-gray-100">
              {companies.length === 0 ? (
                <p className="text-xs text-gray-500 py-2 px-2">No companies available.</p>
              ) : (
                companies.map((c) => {
                  const linked = isLinked(c.id);
                  const a = assignments.find((x) => x.companyId === c.id);
                  return (
                    <div key={c.id} className="px-2 py-2">
                      <label className="flex items-center gap-2 text-sm cursor-pointer font-medium">
                        <input
                          type="checkbox"
                          checked={linked}
                          onChange={(e) => toggleLink(c.id, e.target.checked)}
                        />
                        {c.businessName}
                      </label>
                      {linked && a && (
                        <div className="ml-6 mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-700">
                          <FlagToggle
                            label="Assignable for questions"
                            checked={a.assignable}
                            onChange={(v) => setFlag(c.id, 'assignable', v)}
                          />
                          <FlagToggle
                            label="Can ask questions"
                            checked={a.questionsForUsAccess}
                            onChange={(v) => setFlag(c.id, 'questionsForUsAccess', v)}
                          />
                          <FlagToggle
                            label="Can upload receipts"
                            checked={a.filesAccess}
                            onChange={(v) => setFlag(c.id, 'filesAccess', v)}
                          />
                          <FlagToggle
                            label="Can view financials"
                            checked={a.financialsAccess}
                            onChange={(v) => setFlag(c.id, 'financialsAccess', v)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <p className="mt-1 text-[11px] text-gray-500">
              Defaults: questions + receipts on, financials off (you decide who sees the books).
            </p>
          </Field>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <PortalContactDocumentsPanel contactId={contactId} />

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={update.isPending || setCos.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md disabled:opacity-50"
            >
              {update.isPending || setCos.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

// ── Settings tab ─────────────────────────────────────────────────

function SettingsTab() {
  const { data, isLoading } = usePortalPracticeSettings();
  const update = useUpdatePortalPracticeSettings();
  const settings = data?.settings;

  if (isLoading || !settings) {
    return (
      <div className="py-12 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const toggle = (patch: Parameters<typeof update.mutate>[0]) => update.mutate(patch);

  return (
    <div className="space-y-6 max-w-2xl">
      <Section title="Reminders" description="Automatic email/SMS prompts for unanswered portal items.">
        <ToggleRow
          label="Enable reminders"
          checked={settings.remindersEnabled}
          onChange={(v) => toggle({ remindersEnabled: v })}
        />
        <ToggleRow
          label="Track when reminders are opened"
          checked={settings.openTrackingEnabled}
          onChange={(v) => toggle({ openTrackingEnabled: v })}
        />
        <div className="text-xs text-gray-500 mt-2">
          Cadence (days): {settings.reminderCadenceDays.join(', ')} — editable in Phase 13.
        </div>
      </Section>

      <Section title="Question routing" description="Lets contacts pick the right teammate to answer a question.">
        <ToggleRow
          label="Enable assignable questions"
          checked={settings.assignableQuestionsEnabled}
          onChange={(v) => toggle({ assignableQuestionsEnabled: v })}
        />
      </Section>

      <Section title="Announcement banner" description="Shown across the top of the portal for every contact.">
        <ToggleRow
          label="Show banner"
          checked={settings.announcementEnabled}
          onChange={(v) => toggle({ announcementEnabled: v })}
        />
        <textarea
          value={settings.announcementText ?? ''}
          onChange={(e) => toggle({ announcementText: e.target.value })}
          placeholder="e.g. We're closing for the holidays Dec 24–26."
          rows={3}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </Section>

      <Section
        title="Preview mode (View as Client)"
        description="Lets staff load the portal as a specific contact to verify what they'll see. Wired in Phase 9."
      >
        <ToggleRow
          label="Allow preview mode"
          checked={settings.previewEnabled}
          onChange={(v) => toggle({ previewEnabled: v })}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-600 mt-0.5 mb-3">{description}</p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between py-1 cursor-pointer">
      <span className="text-sm text-gray-800">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
    </label>
  );
}

// ── Shared bits ─────────────────────────────────────────────────

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-sm">
            ×
          </button>
        </header>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Questions tab (bookkeeper inbox) ────────────────────────────

function QuestionsTab() {
  const [statusFilter, setStatusFilter] = useState<'unresolved' | 'open' | 'responded' | 'resolved' | 'all'>('unresolved');
  const [showAsk, setShowAsk] = useState(false);
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuestionsList({ status: statusFilter });
  const { data: pending } = usePendingBatches();
  const markNotified = useMarkBatchNotified();
  const questions = data?.questions ?? [];
  const batches = pending?.batches ?? [];

  return (
    <div className="space-y-6">
      {batches.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                Ready to send: {batches.length} contact{batches.length === 1 ? '' : 's'}
              </h3>
              <p className="text-xs text-amber-800 mt-1">
                Questions you've drafted but not yet released. Click Send to mark them as
                notified — Phase 13 wires actual email delivery.
              </p>
              <ul className="mt-2 text-xs text-amber-900 list-disc list-inside space-y-0.5">
                {batches.map((b) => (
                  <li key={b.contactId}>
                    {b.firstName ?? b.email} · {b.questionIds.length} question
                    {b.questionIds.length === 1 ? '' : 's'}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() =>
                markNotified.mutate(batches.flatMap((b) => b.questionIds))
              }
              disabled={markNotified.isPending}
              className="text-xs font-medium bg-amber-700 hover:bg-amber-800 text-white px-3 py-2 rounded-md disabled:opacity-50"
            >
              <Send className="inline-block h-3.5 w-3.5 mr-1" />
              Send all
            </button>
          </div>
        </section>
      )}

      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="text-sm border border-gray-300 rounded-md px-3 py-2"
        >
          <option value="unresolved">Unresolved</option>
          <option value="open">Open</option>
          <option value="responded">Responded</option>
          <option value="resolved">Resolved</option>
          <option value="all">All</option>
        </select>
        <div className="flex-1" />
        <button
          onClick={() => setShowAsk(true)}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-md"
        >
          <Plus className="h-4 w-4" /> Ask Client
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : isError ? (
        <ErrorBox message="Failed to load questions." />
      ) : questions.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-300 rounded-lg">
          <MessageSquare className="mx-auto h-10 w-10 text-gray-400 mb-3" />
          <h3 className="text-base font-medium text-gray-900 mb-1">No questions match this filter</h3>
          <p className="text-sm text-gray-500">
            Click "Ask Client" to send a question to a portal contact.
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Question</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Company</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Contact</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Status</th>
                <th className="text-left px-4 py-2 font-medium text-gray-700">Asked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {questions.map((q) => (
                <tr
                  key={q.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setOpenQuestionId(q.id)}
                >
                  <td className="px-4 py-3 text-gray-900 max-w-md">
                    <div className="line-clamp-1">{q.body}</div>
                    {q.notifiedAt === null && (
                      <span className="text-xs text-amber-700">draft — not yet sent</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{q.companyName}</td>
                  <td className="px-4 py-3 text-gray-700">{q.contactEmail ?? '—'}</td>
                  <td className="px-4 py-3"><QuestionStatusPill status={q.status} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(q.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAsk && <AskClientModal onClose={() => setShowAsk(false)} />}
      {openQuestionId && (
        <QuestionDetailModal
          questionId={openQuestionId}
          onClose={() => setOpenQuestionId(null)}
        />
      )}
    </div>
  );
}

function QuestionStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    viewed: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    responded: 'bg-blue-50 text-blue-800 ring-blue-600/20',
    resolved: 'bg-green-50 text-green-800 ring-green-600/20',
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ring-1 ring-inset ${
        styles[status] ?? styles['open']
      }`}
    >
      {status}
    </span>
  );
}

function AskClientModal({ onClose }: { onClose: () => void }) {
  const { companies, activeCompanyId } = useCompanyContext();
  const [companyId, setCompanyId] = useState<string>(activeCompanyId ?? companies[0]?.id ?? '');
  const [body, setBody] = useState('');
  const [contactId, setContactId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const { data: contactsData } = usePortalContacts({ companyId, status: 'active' });
  const create = useCreateQuestion();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!companyId) {
      setError('Select a company.');
      return;
    }
    try {
      await create.mutateAsync({
        companyId,
        body: body.trim(),
        assignedContactId: contactId || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create question.');
    }
  };

  return (
    <ModalShell title="Ask a portal contact" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Company" required>
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.businessName}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Assign to (optional)">
          <select
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">— Anyone with portal access —</option>
            {(contactsData?.contacts ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Question" required>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="What would you like the client to clarify?"
          />
        </Field>
        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        <p className="text-xs text-gray-500">
          The question is saved as a draft. Use "Send all" in the Ready-to-send banner to release
          it to the contact's portal.
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={create.isPending || !body.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md"
          >
            {create.isPending ? 'Creating…' : 'Create question'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function QuestionDetailModal({
  questionId,
  onClose,
}: {
  questionId: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuestionDetail(questionId);
  const reply = useBookkeeperReply(questionId);
  const resolve = useResolveQuestion();
  const [text, setText] = useState('');
  const q = data?.question;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await reply.mutateAsync(text.trim());
    setText('');
  };

  return (
    <ModalShell title={q ? `Question · ${q.companyName}` : 'Question'} onClose={onClose}>
      {isLoading || !q ? (
        <div className="py-10 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-500">
              <QuestionStatusPill status={q.status} />{' '}
              <span className="ml-2">
                asked {new Date(q.createdAt).toLocaleString()} · {q.contactEmail ?? 'unassigned'}
              </span>
            </p>
            <p className="mt-2 text-sm text-gray-900 whitespace-pre-wrap">{q.body}</p>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {q.messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-lg p-3 border ${
                  m.senderType === 'contact'
                    ? 'border-indigo-200 bg-indigo-50/40 mr-6'
                    : 'border-gray-200 bg-white ml-6'
                }`}
              >
                <p className="text-xs text-gray-500">
                  {m.senderType === 'contact' ? 'Client' : 'You'} ·{' '}
                  {new Date(m.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{m.body}</p>
              </div>
            ))}
          </div>

          {q.status !== 'resolved' && (
            <form onSubmit={submit} className="space-y-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Reply…"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await resolve.mutateAsync(questionId);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1 text-sm font-medium text-green-700 hover:bg-green-50 px-3 py-2 rounded-md"
                >
                  <CheckCircle2 className="h-4 w-4" /> Resolve
                </button>
                <button
                  type="submit"
                  disabled={reply.isPending || !text.trim()}
                  className="inline-flex items-center gap-1 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-2 rounded-md"
                >
                  <Send className="h-4 w-4" /> Send reply
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </ModalShell>
  );
}

export default ClientPortalAdminPage;
