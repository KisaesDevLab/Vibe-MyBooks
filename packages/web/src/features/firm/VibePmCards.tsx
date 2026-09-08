// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Firm Settings — Vibe Practice Management peer cards.
//   • VibePmPeerCard: the trust root (issuer + public key or JWKS URL),
//     enable switch, last-seen / last-error, "Test a token".
//   • PmClientLinksCard: PM client id → tenant / company / portal contact.
// See docs/vibe-pm-integration.md for the contract PM implements.

import { useEffect, useState } from 'react';
import type { FirmRole, PmClientLinkView } from '@kis-books/shared';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { ErrorMessage } from '../../components/ui/ErrorMessage';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { isApiError } from '../../api/client';
import {
  useVibePmSettings, useSaveVibePmSettings, useTestPeerToken,
  usePmLinks, usePmLinkOptions, useCreatePmLink, useDeletePmLink, useFirmTenants,
} from '../../api/hooks/useFirms';
import { Link2, CheckCircle, XCircle, AlertTriangle, Trash2 } from 'lucide-react';

const ERROR_LABELS: Record<string, string> = {
  sig_invalid: 'Signature did not verify against the stored key',
  unknown_kid: 'Token key id not found in the JWKS',
  expired: 'Token expired',
  replay: 'Token presented more than once',
  jwks_fetch_failed: 'JWKS URL could not be fetched',
  no_link: 'PM client id is not linked to a MyBooks client',
  malformed: 'Token is not a Vibe PM peer token',
  unknown_issuer: 'Issuer is not registered',
  disabled: 'Integration is disabled',
  wrong_firm: 'Token belongs to another firm',
  store_unavailable: 'Replay store (Redis) unavailable',
};

function fmt(ts: string | null): string {
  return ts ? new Date(ts).toLocaleString() : 'never';
}

export function VibePmPeerCard({ firmId, myRole, superAdminManaged, isSuperAdmin }: {
  firmId: string;
  myRole: FirmRole | undefined;
  superAdminManaged: boolean;
  isSuperAdmin: boolean;
}) {
  const settings = useVibePmSettings(firmId);
  const save = useSaveVibePmSettings(firmId);
  const test = useTestPeerToken(firmId);
  const [form, setForm] = useState({ isEnabled: false, issuer: '', mode: 'pem' as 'pem' | 'jwks', publicKeyPem: '', jwksUrl: '' });
  const [hydrated, setHydrated] = useState(false);
  const [token, setToken] = useState('');

  useEffect(() => {
    if (hydrated || !settings.data) return;
    const d = settings.data;
    setForm({
      isEnabled: d.isEnabled,
      issuer: d.issuer ?? '',
      mode: d.keyMode === 'jwks' ? 'jwks' : 'pem',
      publicKeyPem: d.publicKeyPem ?? '',
      jwksUrl: d.jwksUrl ?? '',
    });
    setHydrated(true);
  }, [settings.data, hydrated]);

  if (settings.isLoading) return <LoadingSpinner className="py-8" />;
  if (settings.isError) return <ErrorMessage onRetry={() => settings.refetch()} />;
  const d = settings.data!;
  const canEdit = myRole === 'firm_admin' && (!superAdminManaged || isSuperAdmin);

  const onSave = () => {
    save.mutate({
      isEnabled: form.isEnabled,
      issuer: form.issuer.trim() || undefined,
      ...(form.mode === 'pem'
        ? { publicKeyPem: form.publicKeyPem.trim() || null, jwksUrl: null }
        : { jwksUrl: form.jwksUrl.trim() || null, publicKeyPem: null }),
    });
  };

  return (
    <div className="mt-6 max-w-2xl bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="h-5 w-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-800">Vibe Practice Management</h2>
      </div>
      <p className="text-sm text-gray-600">
        Let the firm's Vibe PM client portal show these books to clients — questions, financials,
        receipts, banking and bill pay — in one place. PM signs each request with its private key;
        paste PM's <strong>public</strong> key (or its JWKS URL) here. Nothing secret is stored.
      </p>
      {superAdminManaged && !isSuperAdmin && (
        <p className="text-sm text-amber-700 flex items-center gap-1">
          <AlertTriangle className="h-4 w-4" /> This firm is managed by the system administrator; only they can change these settings.
        </p>
      )}

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.isEnabled} disabled={!canEdit}
          onChange={(e) => setForm((f) => ({ ...f, isEnabled: e.target.checked }))} />
        <span className="text-sm font-medium text-gray-700">Enable the Vibe PM peer</span>
      </label>

      <Input label="Issuer (the iss claim PM sends)" value={form.issuer} disabled={!canEdit}
        placeholder="https://portal.yourfirm.com" autoComplete="off"
        onChange={(e) => setForm((f) => ({ ...f, issuer: e.target.value }))} />

      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input type="radio" name="vibe-pm-mode" checked={form.mode === 'pem'} disabled={!canEdit}
            onChange={() => setForm((f) => ({ ...f, mode: 'pem' }))} /> Public key (PEM)
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" name="vibe-pm-mode" checked={form.mode === 'jwks'} disabled={!canEdit}
            onChange={() => setForm((f) => ({ ...f, mode: 'jwks' }))} /> JWKS URL
        </label>
      </div>

      {form.mode === 'pem' ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Public key</label>
          <textarea className="w-full font-mono text-xs border border-gray-300 rounded-md p-2 h-40 disabled:bg-gray-50"
            value={form.publicKeyPem} disabled={!canEdit} spellCheck={false}
            placeholder={'-----BEGIN PUBLIC KEY-----\n…\n-----END PUBLIC KEY-----'}
            onChange={(e) => setForm((f) => ({ ...f, publicKeyPem: e.target.value }))} />
          <p className="text-xs text-gray-500 mt-1">RSA 2048+ or EC P-256 / P-384. A private key is refused.</p>
        </div>
      ) : (
        <Input label="JWKS URL" value={form.jwksUrl} disabled={!canEdit} placeholder="https://portal.yourfirm.com/.well-known/jwks.json"
          onChange={(e) => setForm((f) => ({ ...f, jwksUrl: e.target.value }))} />
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-gray-500">Stored key</dt>
        <dd className="text-gray-800">
          {d.keyMode === 'pem' ? `${d.keyDetail ?? 'PEM'} · ${d.keyFingerprint?.slice(0, 16) ?? ''}…`
            : d.keyMode === 'jwks' ? 'JWKS URL' : 'none'}
        </dd>
        <dt className="text-gray-500">Last seen</dt>
        <dd className="text-gray-800">{fmt(d.lastSeenAt)}</dd>
        <dt className="text-gray-500">Last error</dt>
        <dd className={d.lastError ? 'text-red-700' : 'text-gray-800'}>
          {d.lastError ? `${ERROR_LABELS[d.lastError] ?? d.lastError} (${fmt(d.lastErrorAt)})` : 'none'}
        </dd>
      </dl>

      {save.error && <p className="text-sm text-red-600">{save.error.message}</p>}
      {save.isSuccess && !save.isPending && <p className="text-sm text-green-700 flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Saved</p>}

      {canEdit && (
        <div className="flex gap-3 pt-2">
          <Button onClick={onSave} loading={save.isPending}>Save</Button>
        </div>
      )}

      {canEdit && (
        <div className="border-t border-gray-100 pt-4 space-y-2">
          <h3 className="text-sm font-semibold text-gray-700">Test a token</h3>
          <p className="text-xs text-gray-500">Paste a token minted by PM. It is verified without being consumed, so PM can still use it.</p>
          <textarea className="w-full font-mono text-xs border border-gray-300 rounded-md p-2 h-20" value={token}
            spellCheck={false} onChange={(e) => setToken(e.target.value)} placeholder="eyJhbGciOi…" />
          <Button variant="secondary" disabled={token.trim().length < 20} loading={test.isPending}
            onClick={() => test.mutate(token.trim())}>Verify</Button>
          {test.data && (
            test.data.ok ? (
              <p className="text-sm text-green-700 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" /> Valid — issuer {test.data.issuer}
                {test.data.claims.pm_client_id ? `, PM client ${test.data.claims.pm_client_id}` : ', no pm_client_id'}
                {test.data.claims.actor ? `, actor ${test.data.claims.actor.email}` : ''}
              </p>
            ) : (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <XCircle className="h-4 w-4" /> {ERROR_LABELS[test.data.code] ?? test.data.code}
              </p>
            )
          )}
          {test.error && <p className="text-sm text-red-600">{isApiError(test.error) ? test.error.message : 'Verification failed'}</p>}
        </div>
      )}
    </div>
  );
}

export function PmClientLinksCard({ firmId, myRole }: { firmId: string; myRole: FirmRole | undefined }) {
  const links = usePmLinks(firmId);
  const tenants = useFirmTenants(firmId);
  const create = useCreatePmLink(firmId);
  const remove = useDeletePmLink(firmId);
  const [pmClientId, setPmClientId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [contactId, setContactId] = useState('');
  const [pendingDelete, setPendingDelete] = useState<PmClientLinkView | null>(null);
  const options = usePmLinkOptions(firmId, tenantId || null);
  const canEdit = myRole === 'firm_admin' || myRole === 'firm_staff';

  useEffect(() => { setCompanyId(''); setContactId(''); }, [tenantId]);

  if (links.isLoading) return <LoadingSpinner className="py-8" />;
  if (links.isError) return <ErrorMessage onRetry={() => links.refetch()} />;

  const rows = links.data?.links ?? [];
  const activeTenants = (tenants.data?.assignments ?? []).filter((a) => a.isActive);
  const contacts = (options.data?.contacts ?? []).filter((c) => !companyId || c.companyIds.includes(companyId));
  const canSubmit = pmClientId.trim() && tenantId && companyId && contactId && !create.isPending;

  return (
    <div className="mt-6 max-w-3xl bg-white rounded-lg border border-gray-200 shadow-sm p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Linked clients (Vibe PM)</h2>
      <p className="text-sm text-gray-600">
        Each PM client entity maps to one MyBooks company and the portal contact whose permissions PM
        inherits. A link stops working the moment the contact is paused, unlinked from the company, or
        the client leaves this firm.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">No clients linked yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-3">PM client id</th>
                <th className="py-2 pr-3">Client</th>
                <th className="py-2 pr-3">Company</th>
                <th className="py-2 pr-3">Portal contact</th>
                <th className="py-2 pr-3">Status</th>
                {canEdit && <th className="py-2" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-b border-gray-100">
                  <td className="py-2 pr-3 font-mono text-xs">{l.pmClientId}</td>
                  <td className="py-2 pr-3">{l.tenant.name}</td>
                  <td className="py-2 pr-3">{l.company.name}</td>
                  <td className="py-2 pr-3">
                    {[l.contact.firstName, l.contact.lastName].filter(Boolean).join(' ') || l.contact.email}
                    <span className="block text-xs text-gray-500">{l.contact.email}</span>
                  </td>
                  <td className="py-2 pr-3">
                    {l.active
                      ? <span className="text-green-700 flex items-center gap-1"><CheckCircle className="h-4 w-4" /> Active</span>
                      : <span className="text-amber-700 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Inactive</span>}
                  </td>
                  {canEdit && (
                    <td className="py-2 text-right">
                      <button type="button" className="text-gray-400 hover:text-red-600" title="Remove link"
                        onClick={() => setPendingDelete(l)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canEdit && (
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Link a client</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input label="PM client id" value={pmClientId} autoComplete="off" placeholder="Copy from Vibe PM → Client → Integrations"
              onChange={(e) => setPmClientId(e.target.value)} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client (tenant)</label>
              <select className="w-full border border-gray-300 rounded-md p-2 text-sm" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
                <option value="">Choose…</option>
                {activeTenants.map((a) => <option key={a.tenantId} value={a.tenantId}>{a.tenantName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
              <select className="w-full border border-gray-300 rounded-md p-2 text-sm" value={companyId} disabled={!tenantId || options.isLoading}
                onChange={(e) => { setCompanyId(e.target.value); setContactId(''); }}>
                <option value="">Choose…</option>
                {(options.data?.companies ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Portal contact</label>
              <select className="w-full border border-gray-300 rounded-md p-2 text-sm" value={contactId} disabled={!companyId}
                onChange={(e) => setContactId(e.target.value)}>
                <option value="">Choose…</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {[c.firstName, c.lastName].filter(Boolean).join(' ') || c.email} ({c.email}){c.status !== 'active' ? ` — ${c.status}` : ''}
                  </option>
                ))}
              </select>
              {companyId && contacts.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">No portal contact is linked to that company yet. Add one under Practice → Client Portal.</p>
              )}
            </div>
          </div>
          {options.error && <p className="text-sm text-red-600">{isApiError(options.error) ? options.error.message : 'Could not load options'}</p>}
          {create.error && <p className="text-sm text-red-600">{create.error.message}</p>}
          <Button disabled={!canSubmit} loading={create.isPending}
            onClick={() => create.mutate(
              { pmClientId: pmClientId.trim(), tenantId, companyId, contactId },
              { onSuccess: () => { setPmClientId(''); setContactId(''); } },
            )}>
            Link client
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Remove this link?"
        message={pendingDelete ? `Vibe PM will no longer be able to show ${pendingDelete.company.name} to PM client ${pendingDelete.pmClientId}.` : undefined}
        confirmLabel="Remove"
        variant="danger"
        onConfirm={() => { if (pendingDelete) remove.mutate(pendingDelete.id); setPendingDelete(null); }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
