// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// TB Settings (Phase 3): tax profile (return form, seed pinning),
// activity units, tag→unit mapping, and firm custom codes. Profile and
// custom-code writes are firm-admin (owner) acts — the UI hides those
// controls for other staff; the server enforces regardless.

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { tbReturnForms, tbActivityUnitTypes, tbActivityTypes } from '@kis-books/shared';
import { apiClient, isApiError } from '../../api/client';
import { useMe } from '../../api/hooks/useAuth';
import {
  useActivityUnits, useArchiveActivityUnit, useCreateActivityUnit, useDeactivateFirmCode,
  useFirmCodes, useMapTag, useRenameActivityUnit, useSaveFirmCode, useSetDefaultActivityUnit,
  useTagMappings, useTbProfile, useUpsertTbProfile,
  type TbFirmCode, type TbSeedVersion,
} from '../../api/hooks/useTb';
import { useToast } from '../../components/ui/Toaster';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

const ACTIVITY_LABELS: Record<string, string> = {
  business: 'Business',
  rental: 'Rental',
  farm: 'Farm',
  farm_rental: 'Farm Rental',
  common: 'Common',
};

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-medium text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500 mb-3">{subtitle}</p>}
      {children}
    </div>
  );
}

// ── Tax profile ─────────────────────────────────────────────────────

function ProfileCard({ isAdmin }: { isAdmin: boolean }) {
  const toast = useToast();
  const { data, isLoading } = useTbProfile();
  const upsert = useUpsertTbProfile();
  const { data: versions } = useQuery({
    queryKey: ['tb', 'seed-versions'],
    queryFn: () => apiClient<{ versions: TbSeedVersion[] }>('/tb/seed-versions'),
  });
  const [returnForm, setReturnForm] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null | undefined>(undefined);
  const [electionDate, setElectionDate] = useState<string | null | undefined>(undefined);
  const [activityType, setActivityType] = useState<string | null>(null);

  if (isLoading || !data) return <Card title="Tax profile"><LoadingSpinner className="py-6" /></Card>;

  const effForm = returnForm ?? data.profile?.returnForm ?? '';
  const effPinned = pinned !== undefined ? pinned : (data.profile?.pinnedSeedVersionId ?? null);
  const effElection = electionDate !== undefined ? electionDate : (data.profile?.sCorpElectionDate ?? null);
  const effActivity = activityType ?? data.profile?.defaultActivityType ?? 'business';
  const dirty = effForm !== (data.profile?.returnForm ?? '') ||
    effPinned !== (data.profile?.pinnedSeedVersionId ?? null) ||
    effElection !== (data.profile?.sCorpElectionDate ?? null) ||
    effActivity !== (data.profile?.defaultActivityType ?? 'business');

  const fyLabel = new Date(2000, data.fiscal.fiscalYearStartMonth - 1, 1).toLocaleString(undefined, { month: 'long' });

  return (
    <Card title="Tax profile" subtitle="Return form drives which tax codes are assignable (ADR-TB-02).">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="tb-form">Return form</label>
          <select id="tb-form" value={effForm} disabled={!isAdmin}
            onChange={(e) => setReturnForm(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50">
            <option value="" disabled>Select…</option>
            {tbReturnForms.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="tb-activity">Activity type</label>
          <select id="tb-activity" value={effActivity} disabled={!isAdmin}
            onChange={(e) => setActivityType(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50">
            <option value="business">Business</option>
            <option value="rental">Rental</option>
            <option value="farm">Farm</option>
            <option value="farm_rental">Farm rental</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="tb-pin">Tax code seed</label>
          <select id="tb-pin" value={effPinned ?? ''} disabled={!isAdmin}
            onChange={(e) => setPinned(e.target.value || null)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50">
            <option value="">Latest for tax year (recommended)</option>
            {(versions?.versions ?? []).map((v) => (
              <option key={v.id} value={v.id}>TY{v.taxYear} v{v.version}{v.label ? ` — ${v.label}` : ''}</option>
            ))}
          </select>
        </div>
        {effForm === '1120S' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="tb-election">S-corp election date</label>
            <input id="tb-election" type="date" value={effElection ?? ''} disabled={!isAdmin}
              onChange={(e) => setElectionDate(e.target.value || null)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50" />
          </div>
        )}
        {isAdmin && (
          <Button variant="primary" disabled={!dirty || !effForm || upsert.isPending}
            onClick={() => upsert.mutate(
              { returnForm: effForm, pinnedSeedVersionId: effPinned, sCorpElectionDate: effForm === '1120S' ? effElection : null, defaultActivityType: effActivity },
              {
                onSuccess: () => toast.success('Tax profile saved'),
                onError: (e) => toast.error(isApiError(e) ? e.message : 'Save failed'),
              },
            )}>
            Save
          </Button>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Fiscal year starts in {fyLabel} · current tax year {data.fiscal.currentTaxYear} (FY end {data.fiscal.currentFiscalYearEnd}).
        {!isAdmin && ' Contact a firm administrator to change the tax profile.'}
      </p>
    </Card>
  );
}

// ── Activity units ──────────────────────────────────────────────────

function UnitsCard() {
  const toast = useToast();
  const { data, isLoading } = useActivityUnits(true);
  const create = useCreateActivityUnit();
  const rename = useRenameActivityUnit();
  const setDefault = useSetDefaultActivityUnit();
  const archive = useArchiveActivityUnit();
  const [newType, setNewType] = useState('business');
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const err = (e: unknown) => toast.error(isApiError(e) ? e.message : 'Operation failed');

  return (
    <Card title="Activity units" subtitle="Return activities (Sch C/E/F instances). Lines fall to the default unit unless their tag maps elsewhere (D13).">
      {isLoading && <LoadingSpinner className="py-6" />}
      {data && (
        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
              <th className="py-2 pr-3">Activity</th>
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Default</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.units.map((u) => (
              <tr key={u.id} className={`border-b border-gray-100 ${u.archivedAt ? 'opacity-50' : ''}`}>
                <td className="py-2 pr-3">{ACTIVITY_LABELS[u.activityType]}</td>
                <td className="py-2 pr-3 tabular-nums">{u.instanceNumber}</td>
                <td className="py-2 pr-3">
                  {editingId === u.id ? (
                    <form className="flex gap-2" onSubmit={(e) => {
                      e.preventDefault();
                      rename.mutate({ id: u.id, displayName: editName }, {
                        onSuccess: () => setEditingId(null),
                        onError: err,
                      });
                    }}>
                      <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm" />
                      <button type="submit" className="text-blue-600 text-xs font-medium">Save</button>
                      <button type="button" className="text-gray-500 text-xs" onClick={() => setEditingId(null)}>Cancel</button>
                    </form>
                  ) : (
                    <span>{u.displayName}{u.archivedAt && ' (archived)'}</span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  {u.isDefault ? (
                    <span className="inline-block rounded-full bg-blue-50 text-blue-700 text-xs px-2 py-0.5 font-medium">Default</span>
                  ) : !u.archivedAt ? (
                    <button className="text-xs text-gray-500 hover:text-blue-600 underline"
                      onClick={() => setDefault.mutate(u.id, { onError: err })}>
                      make default
                    </button>
                  ) : null}
                </td>
                <td className="py-2 text-right">
                  {!u.archivedAt && (
                    <>
                      <button className="text-xs text-gray-500 hover:text-blue-600 underline mr-3"
                        onClick={() => { setEditingId(u.id); setEditName(u.displayName); }}>
                        rename
                      </button>
                      <button className="text-xs text-gray-500 hover:text-red-600 underline"
                        onClick={() => archive.mutate(u.id, {
                          onSuccess: (r) => toast.info(r.mode === 'deleted' ? 'Unit deleted' : 'Unit archived (it has history)'),
                          onError: err,
                        })}>
                        remove
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {data.units.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-gray-500">No activity units yet — the first one you add becomes the default.</td></tr>
            )}
          </tbody>
        </table>
      )}
      <form className="flex items-end gap-3" onSubmit={(e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        create.mutate({ activityType: newType, displayName: newName.trim() }, {
          onSuccess: () => setNewName(''),
          onError: err,
        });
      }}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="unit-type">Activity type</label>
          <select id="unit-type" value={newType} onChange={(e) => setNewType(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
            {tbActivityUnitTypes.map((t) => <option key={t} value={t}>{ACTIVITY_LABELS[t]}</option>)}
          </select>
        </div>
        <div className="grow max-w-sm">
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="unit-name">Display name</label>
          <input id="unit-name" value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Rental #2 — Oak Ave" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <Button type="submit" variant="secondary" disabled={create.isPending || !newName.trim()}>Add unit</Button>
      </form>
    </Card>
  );
}

// ── Tag mapping ─────────────────────────────────────────────────────

function TagMappingCard() {
  const toast = useToast();
  const { data: unitsData } = useActivityUnits();
  const { data, isLoading } = useTagMappings();
  const mapTag = useMapTag();

  const liveUnits = unitsData?.units ?? [];
  const defaultUnit = liveUnits.find((u) => u.isDefault);

  return (
    <Card title="Tag → activity mapping" subtitle="Line-level tags route balances to activity units. Unmapped tags flow to the default unit.">
      {isLoading && <LoadingSpinner className="py-6" />}
      {data && data.tags.length === 0 && (
        <p className="text-sm text-gray-500">No tags defined for this company yet. Create tags under Manage → Tags, apply them to journal lines, then map them here.</p>
      )}
      {data && data.tags.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
              <th className="py-2 pr-3">Tag</th>
              <th className="py-2 pr-3">Lines tagged</th>
              <th className="py-2">Activity unit</th>
            </tr>
          </thead>
          <tbody>
            {data.tags.map((t) => (
              <tr key={t.id} className="border-b border-gray-100">
                <td className="py-2 pr-3">
                  <span className="inline-flex items-center gap-2">
                    {t.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />}
                    {t.name}
                  </span>
                </td>
                <td className="py-2 pr-3 tabular-nums">{t.lineUsage.toLocaleString()}</td>
                <td className="py-2">
                  <select value={t.activityUnitId ?? ''} aria-label={`Activity unit for ${t.name}`}
                    onChange={(e) => mapTag.mutate(
                      { tagId: t.id, activityUnitId: e.target.value || null },
                      { onError: (err) => toast.error(isApiError(err) ? err.message : 'Mapping failed') },
                    )}
                    className="rounded-lg border border-gray-300 px-2 py-1 text-sm">
                    <option value="">→ default{defaultUnit ? ` (${defaultUnit.displayName})` : ''}</option>
                    {liveUnits.map((u) => (
                      <option key={u.id} value={u.id}>{ACTIVITY_LABELS[u.activityType]} #{u.instanceNumber} — {u.displayName}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// ── Firm custom codes ──────────────────────────────────────────────

const EMPTY_CODE: Partial<TbFirmCode> = { code: '', description: '', returnForm: '1065', activityType: 'common' };

function FirmCodesCard({ isAdmin }: { isAdmin: boolean }) {
  const toast = useToast();
  const { data, isLoading } = useFirmCodes(true);
  const save = useSaveFirmCode();
  const deactivate = useDeactivateFirmCode();
  const [draft, setDraft] = useState<Partial<TbFirmCode> | null>(null);

  const err = (e: unknown) => toast.error(isApiError(e) ? e.message : 'Save failed');

  return (
    <Card title="Firm custom tax codes"
      subtitle={`FIRM:-namespaced codes${data?.ownedByFirm ? ' shared across all of your firm’s clients' : ''} — never touched by seed updates.`}>
      {isLoading && <LoadingSpinner className="py-6" />}
      {data && (
        <table className="w-full text-sm mb-3">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200">
              <th className="py-2 pr-3">Code</th>
              <th className="py-2 pr-3">Form</th>
              <th className="py-2 pr-3">Activity</th>
              <th className="py-2 pr-3">Description</th>
              <th className="py-2 pr-3">M-1</th>
              {isAdmin && <th className="py-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data.codes.map((c) => (
              <tr key={c.id} className={`border-b border-gray-100 ${c.isActive ? '' : 'opacity-50'}`}>
                <td className="py-2 pr-3 font-mono text-xs">{c.code}{!c.isActive && ' (inactive)'}</td>
                <td className="py-2 pr-3">{c.returnForm}</td>
                <td className="py-2 pr-3">{ACTIVITY_LABELS[c.activityType] ?? c.activityType}</td>
                <td className="py-2 pr-3">{c.description || '—'}</td>
                <td className="py-2 pr-3">{c.isM1Adjustment ? 'Yes' : '—'}</td>
                {isAdmin && (
                  <td className="py-2 text-right">
                    <button className="text-xs text-gray-500 hover:text-blue-600 underline mr-3"
                      onClick={() => setDraft(c)}>edit</button>
                    {c.isActive && (
                      <button className="text-xs text-gray-500 hover:text-red-600 underline"
                        onClick={() => deactivate.mutate(c.id, { onError: err })}>deactivate</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {data.codes.length === 0 && (
              <tr><td colSpan={6} className="py-4 text-gray-500">No custom codes.</td></tr>
            )}
          </tbody>
        </table>
      )}
      {isAdmin && !draft && (
        <Button variant="secondary" onClick={() => setDraft(EMPTY_CODE)}>Add custom code</Button>
      )}
      {isAdmin && draft && (
        <form className="flex flex-wrap items-end gap-3 rounded-lg bg-gray-50 border border-gray-200 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const bare = (draft.code ?? '').replace(/^FIRM:/, '');
            if (!bare) return;
            save.mutate({ ...draft, code: bare }, {
              onSuccess: () => { setDraft(null); toast.success('Custom code saved'); },
              onError: err,
            });
          }}>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="fc-code">Code (FIRM: added automatically)</label>
            <input id="fc-code" value={(draft.code ?? '').replace(/^FIRM:/, '')}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="fc-form">Form</label>
            <select id="fc-form" value={draft.returnForm} onChange={(e) => setDraft({ ...draft, returnForm: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {tbReturnForms.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="fc-act">Activity</label>
            <select id="fc-act" value={draft.activityType} onChange={(e) => setDraft({ ...draft, activityType: e.target.value })}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {tbActivityTypes.map((a) => <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>)}
            </select>
          </div>
          <div className="grow max-w-sm">
            <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="fc-desc">Description</label>
            <input id="fc-desc" value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
            <input type="checkbox" checked={draft.isM1Adjustment ?? false}
              onChange={(e) => setDraft({ ...draft, isM1Adjustment: e.target.checked })} />
            M-1 adjustment
          </label>
          <Button type="submit" variant="primary" disabled={save.isPending}>Save</Button>
          <Button type="button" variant="secondary" onClick={() => setDraft(null)}>Cancel</Button>
        </form>
      )}
    </Card>
  );
}

// ── Closing date (Phase 10, ADR-TB-04) ─────────────────────────────

function ClosingDateCard({ isAdmin }: { isAdmin: boolean }) {
  const toast = useToast();
  const { data, refetch } = useQuery({
    queryKey: ['tb', 'closing-date'],
    queryFn: () => apiClient<{ closingDate: string | null; setAt: string | null }>('/tb/closing-date'),
  });
  const [draft, setDraft] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (closingDate: string | null) =>
      apiClient('/tb/closing-date', { method: 'PUT', body: JSON.stringify({ closingDate }) }),
    onSuccess: () => { setDraft(null); refetch(); toast.success('Closing date updated'); },
    onError: (e) => toast.error(isApiError(e) ? e.message : 'Save failed'),
  });
  const effective = draft ?? data?.closingDate ?? '';
  return (
    <Card title="Closing date"
      subtitle="Locks client-side changes on or before this date. Firm staff can override with confirmation (audit-logged); AJEs are always allowed.">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="tb-close">Closed through</label>
          <input id="tb-close" type="date" value={effective} disabled={!isAdmin}
            onChange={(e) => setDraft(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50" />
        </div>
        {isAdmin && (
          <>
            <Button variant="primary" disabled={save.isPending || !effective || effective === (data?.closingDate ?? '')}
              onClick={() => save.mutate(effective)}>Set</Button>
            {data?.closingDate && (
              <Button variant="secondary" disabled={save.isPending}
                onClick={() => save.mutate(null)}>Clear</Button>
            )}
          </>
        )}
      </div>
      {data?.closingDate && data.setAt && (
        <p className="text-xs text-gray-500 mt-2">Closed on {new Date(data.setAt).toLocaleString()}.</p>
      )}
      {!isAdmin && <p className="text-xs text-gray-500 mt-2">Only a firm administrator can change the closing date.</p>}
    </Card>
  );
}

// ── Tickmark library (7.3) ─────────────────────────────────────────

interface TickmarkRow { id: string; symbol: string; description: string; color: string | null; sortOrder: number }

const TICK_COLORS = ['gray', 'blue', 'green', 'red', 'purple', 'yellow'];

function TickmarksCard() {
  const toast = useToast();
  const { data, refetch } = useQuery({
    queryKey: ['tb', 'tickmarks'],
    queryFn: () => apiClient<{ tickmarks: TickmarkRow[] }>('/tb/tickmarks'),
  });
  const [draft, setDraft] = useState({ symbol: '', description: '', color: 'gray' });
  const errT = (e: unknown) => toast.error(isApiError(e) ? e.message : 'Operation failed');
  const save = useMutation({
    mutationFn: () => apiClient('/tb/tickmarks', { method: 'POST', body: JSON.stringify(draft) }),
    onSuccess: () => { setDraft({ symbol: '', description: '', color: 'gray' }); refetch(); },
    onError: errT,
  });
  const seed = useMutation({
    mutationFn: () => apiClient('/tb/tickmarks/seed-defaults', { method: 'POST' }),
    onSuccess: () => refetch(),
    onError: errT,
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiClient(`/tb/tickmarks/${id}`, { method: 'DELETE' }),
    onSuccess: () => refetch(),
    onError: errT,
  });
  const marks = data?.tickmarks ?? [];
  return (
    <Card title="Tickmark library" subtitle="Symbols used to annotate trial balance cells across all clients.">
      <div className="flex flex-wrap gap-2 mb-3">
        {marks.map((m) => (
          <span key={m.id} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1 text-sm">
            <span className="font-medium">{m.symbol}</span>
            <span className="text-xs text-gray-500">{m.description}</span>
            <button className="text-gray-300 hover:text-red-500 text-xs" aria-label={`Delete ${m.symbol}`}
              onClick={() => remove.mutate(m.id)}>✕</button>
          </span>
        ))}
        {marks.length === 0 && (
          <Button variant="secondary" onClick={() => seed.mutate()} loading={seed.isPending}>Load standard library</Button>
        )}
      </div>
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (draft.symbol && draft.description) save.mutate(); }}>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="tm-sym">Symbol</label>
          <input id="tm-sym" value={draft.symbol} maxLength={8} onChange={(e) => setDraft({ ...draft, symbol: e.target.value })}
            className="w-16 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-center" />
        </div>
        <div className="grow max-w-sm">
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="tm-desc">Description</label>
          <input id="tm-desc" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="e.g. Agreed to loan statement" className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="tm-color">Color</label>
          <select id="tm-color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
            {TICK_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <Button type="submit" variant="secondary" size="sm" disabled={!draft.symbol || !draft.description || save.isPending}>Add</Button>
      </form>
    </Card>
  );
}

export function TbSettingsPage() {
  const { data: meData } = useMe();
  const role = meData?.user?.role;
  const isSuperAdmin = !!(meData?.user as { isSuperAdmin?: boolean } | undefined)?.isSuperAdmin;
  const isAdmin = role === 'owner' || isSuperAdmin;

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Trial Balance Settings</h1>
        <p className="text-gray-600">Tax profile, return activities, tag routing, and firm custom codes for this client.</p>
      </div>
      <ProfileCard isAdmin={isAdmin} />
      <ClosingDateCard isAdmin={isAdmin} />
      <UnitsCard />
      <TagMappingCard />
      <TickmarksCard />
      <FirmCodesCard isAdmin={isAdmin} />
    </div>
  );
}
