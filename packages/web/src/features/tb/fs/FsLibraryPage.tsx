// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Firm library for report-ready financial statements: letterhead + logo,
// accountant's-report letters (seeded from the system library, editable
// per firm), style presets and layout templates. Shared by every client
// the firm serves; editing is limited to firm administrators (owners).

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Star, Trash2 } from 'lucide-react';
import { FS_BUILTIN_STYLES, type FsLetterheadInput, type FsStyle } from '@kis-books/shared';
import {
  useDeleteLetter, useDeletePreset, useDeleteTemplate, useFsLibrary, useSaveLetter, useSaveLetterhead, useSavePreset, useSaveTemplate,
  type FsLibrary, type FsLibraryLetter,
} from '../../../api/hooks/useFinancialStatements';
import { useMe } from '../../../api/hooks/useAuth';
import { isApiError } from '../../../api/client';
import { Button } from '../../../components/ui/Button';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';
import { useToast } from '../../../components/ui/Toaster';
import { RichTextEditor } from '../../admin/RichTextEditor';
import { StylePanel } from './FsPanels';

type Tab = 'letterhead' | 'letters' | 'styles' | 'templates';
const input = 'w-full rounded-md border border-gray-300 px-2 text-sm';
const LETTER_VARS = [
  'client_name', 'firm_name', 'firm_city', 'firm_state', 'firm_city_state', 'accountant_signature', 'period_start_date', 'period_end_date',
  'as_of_date', 'period_description', 'basis_of_accounting', 'financial_statement_titles', 'report_date', 'report_title',
].map((key) => ({ key, label: key.replace(/_/g, ' ') }));

export function FsLibraryPage() {
  const { data, isLoading, isError, refetch } = useFsLibrary();
  const { data: me } = useMe();
  const canEdit = me?.user?.role === 'owner' || me?.user?.isSuperAdmin === true;
  const [tab, setTab] = useState<Tab>('letterhead');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link to="/tb/financial-statements" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ArrowLeft className="h-4 w-4" />Financial Statements</Link>
      <h1 className="text-2xl font-semibold text-gray-900 mt-2">Firm library</h1>
      <p className="text-sm text-gray-500 mt-1">
        {data?.ownedByFirm ? 'Shared by every client your firm serves.' : 'Used by every set of statements in this workspace.'}
        {!canEdit && ' Only firm administrators can change it.'}
      </p>
      <div className="mt-4 flex gap-1 border-b border-gray-200">
        {([['letterhead', 'Letterhead'], ['letters', "Accountant's reports"], ['styles', 'Styles'], ['templates', 'Layout templates']] as Array<[Tab, string]>).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-sm font-medium ${tab === k ? 'border-b-2 border-primary-600 text-primary-700' : 'text-gray-500 hover:text-gray-800'}`}>{l}</button>
        ))}
      </div>
      <div className="mt-4">
        {isLoading ? <LoadingSpinner className="py-16" /> : isError || !data ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">Could not load the library. <button className="underline" onClick={() => refetch()}>Retry</button></div>
        ) : tab === 'letterhead' ? <LetterheadTab lh={data.letterhead} canEdit={canEdit} />
          : tab === 'letters' ? <LettersTab letters={data.letters} canEdit={canEdit} />
            : tab === 'styles' ? <StylesTab presets={data.presets} canEdit={canEdit} />
              : <TemplatesTab templates={data.templates} canEdit={canEdit} />}
      </div>
    </div>
  );
}

function LetterheadTab({ lh, canEdit }: { lh: FsLibrary['letterhead']; canEdit: boolean }) {
  const toast = useToast();
  const save = useSaveLetterhead();
  const [form, setForm] = useState<FsLetterheadInput>({});
  useEffect(() => {
    setForm({
      displayName: lh?.displayName ?? '', addressLine1: lh?.addressLine1 ?? '', addressLine2: lh?.addressLine2 ?? '', city: lh?.city ?? '',
      state: lh?.state ?? '', postalCode: lh?.postalCode ?? '', phone: lh?.phone ?? '', email: lh?.email ?? '', website: lh?.website ?? '',
      logoDataUri: lh?.logoDataUri ?? null, accountantSignature: lh?.accountantSignature ?? '', letterheadAlign: lh?.letterheadAlign ?? 'left',
    });
  }, [lh]);
  const set = (k: keyof FsLetterheadInput, v: string | null) => setForm((f) => ({ ...f, [k]: v }));
  const onLogo = (file: File | undefined) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) { toast.error('Logo must be a PNG or JPEG'); return; }
    if (file.size > 700 * 1024) { toast.error('Logo must be 700 KB or smaller'); return; }
    const r = new FileReader();
    r.onload = () => set('logoDataUri', String(r.result));
    r.readAsDataURL(file);
  };
  const text = (k: keyof FsLetterheadInput, label: string) => (
    <label className="block"><span className="text-xs font-medium text-gray-600">{label}</span>
      <input className={`mt-0.5 ${input}`} value={(form[k] as string | null | undefined) ?? ''} onChange={(e) => set(k, e.target.value)} /></label>
  );
  return (
    <fieldset disabled={!canEdit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-3">
        {text('displayName', 'Firm name')}
        {text('addressLine1', 'Address')}
        {text('addressLine2', 'Address line 2')}
        <div className="grid grid-cols-3 gap-2">{text('city', 'City')}{text('state', 'State')}{text('postalCode', 'ZIP')}</div>
        <div className="grid grid-cols-2 gap-2">{text('phone', 'Phone')}{text('email', 'Email')}</div>
        {text('website', 'Website')}
        {text('accountantSignature', "Signature line (e.g. 'Smith & Co., CPAs')")}
        <label className="block"><span className="text-xs font-medium text-gray-600">Letterhead alignment</span>
          <select className={`mt-0.5 ${input}`} value={form.letterheadAlign ?? 'left'} onChange={(e) => set('letterheadAlign', e.target.value)}>
            <option value="left">Left</option><option value="center">Centered</option>
          </select></label>
        <div>
          <span className="text-xs font-medium text-gray-600">Logo (PNG or JPEG, up to 700 KB)</span>
          <div className="mt-1 flex items-center gap-3">
            <input type="file" accept="image/png,image/jpeg" onChange={(e) => onLogo(e.target.files?.[0])} className="text-sm" />
            {form.logoDataUri && <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => set('logoDataUri', null)}>Remove</button>}
          </div>
        </div>
        {canEdit && <Button loading={save.isPending} onClick={() => save.mutate(form, { onSuccess: () => toast.success('Letterhead saved'), onError: (e) => toast.error(isApiError(e) ? e.message : 'Save failed') })}>Save letterhead</Button>}
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-gray-400 mb-3">Preview</p>
        <div className={form.letterheadAlign === 'center' ? 'text-center' : ''}>
          {form.logoDataUri && <img src={form.logoDataUri} alt="" className={`max-h-16 max-w-[200px] mb-2 ${form.letterheadAlign === 'center' ? 'mx-auto' : ''}`} />}
          <div className="font-bold text-gray-900">{form.displayName || 'Your firm name'}</div>
          <div className="text-xs text-gray-600">
            {[form.addressLine1, form.addressLine2, [form.city, [form.state, form.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
            <div>{[form.phone, form.email, form.website].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
      </div>
    </fieldset>
  );
}

function LettersTab({ letters, canEdit }: { letters: FsLibraryLetter[]; canEdit: boolean }) {
  const toast = useToast();
  const save = useSaveLetter();
  const del = useDeleteLetter();
  const [selected, setSelected] = useState<string | 'new' | null>(letters[0]?.id ?? null);
  const current = selected === 'new' ? null : letters.find((l) => l.id === selected) ?? null;
  const [form, setForm] = useState({ name: '', letterType: 'compilation' as 'compilation' | 'preparation', title: '', bodyHtml: '', isDefault: false });
  useEffect(() => {
    if (selected === 'new') setForm({ name: 'New report', letterType: 'compilation', title: '', bodyHtml: '<p></p>', isDefault: false });
    else if (current) setForm({ name: current.name, letterType: current.letterType, title: current.title ?? '', bodyHtml: current.bodyHtml, isDefault: current.isDefault });
  }, [selected, current]);
  return (
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
      <div className="space-y-1">
        {letters.map((l) => (
          <button key={l.id} onClick={() => setSelected(l.id)} className={`block w-full text-left rounded-md px-3 py-2 text-sm ${selected === l.id ? 'bg-primary-50 text-primary-800' : 'hover:bg-gray-50'} ${l.isActive ? '' : 'opacity-50'}`}>
            {l.isDefault && <Star className="h-3 w-3 inline mr-1 text-amber-500" />}{l.name}
            <span className="block text-xs text-gray-500">{l.letterType === 'compilation' ? 'Compilation (AR-C 80)' : 'Preparation (AR-C 70)'}{l.isActive ? '' : ' · removed'}</span>
          </button>
        ))}
        {canEdit && <Button size="sm" variant="secondary" className="w-full" onClick={() => setSelected('new')}>New report template</Button>}
      </div>
      {selected && (
        <fieldset disabled={!canEdit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="text-xs font-medium text-gray-600">Name</span><input className={`mt-0.5 ${input}`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="block"><span className="text-xs font-medium text-gray-600">Engagement</span>
              <select className={`mt-0.5 ${input}`} value={form.letterType} onChange={(e) => setForm({ ...form, letterType: e.target.value as 'compilation' | 'preparation' })}>
                <option value="compilation">Compilation (AR-C 80)</option><option value="preparation">Preparation (AR-C 70)</option>
              </select></label>
          </div>
          <label className="block"><span className="text-xs font-medium text-gray-600">Printed title</span><input className={`mt-0.5 ${input}`} placeholder="Accountant's Compilation Report" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <RichTextEditor value={form.bodyHtml} onChange={(bodyHtml) => setForm((f) => ({ ...f, bodyHtml }))} variables={LETTER_VARS} ariaLabel="Report wording" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />Default for new statements</label>
          {canEdit && (
            <div className="flex gap-2">
              <Button loading={save.isPending} onClick={() => save.mutate({ ...(current ? { id: current.id } : {}), name: form.name, letterType: form.letterType, title: form.title || null, bodyHtml: form.bodyHtml, isDefault: form.isDefault, isActive: true }, {
                onSuccess: () => toast.success('Report template saved'), onError: (e) => toast.error(isApiError(e) ? e.message : 'Save failed'),
              })}>Save</Button>
              {current && current.isActive && <Button variant="ghost" onClick={() => del.mutate(current.id, { onSuccess: () => toast.info('Removed from the library') })}><Trash2 className="h-4 w-4 mr-1 inline" />Remove</Button>}
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}

function StylesTab({ presets, canEdit }: { presets: Array<{ id: string; name: string; styleJson: FsStyle; builtinKey: string | null; isDefault: boolean }>; canEdit: boolean }) {
  const toast = useToast();
  const save = useSavePreset();
  const del = useDeletePreset();
  const [selected, setSelected] = useState<string | null>(presets[0]?.id ?? null);
  const current = presets.find((p) => p.id === selected) ?? null;
  const [name, setName] = useState('');
  const [style, setStyle] = useState<FsStyle | null>(null);
  useEffect(() => { if (current) { setName(current.name); setStyle(current.styleJson); } }, [current]);
  return (
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
      <div className="space-y-1">
        {presets.map((p) => (
          <button key={p.id} onClick={() => setSelected(p.id)} className={`block w-full text-left rounded-md px-3 py-2 text-sm ${selected === p.id ? 'bg-primary-50 text-primary-800' : 'hover:bg-gray-50'}`}>
            {p.isDefault && <Star className="h-3 w-3 inline mr-1 text-amber-500" />}{p.name}{p.builtinKey ? <span className="ml-1 text-xs text-gray-400">built-in</span> : null}
          </button>
        ))}
        {canEdit && <Button size="sm" variant="secondary" className="w-full" onClick={() => save.mutate({ name: 'New style', style: FS_BUILTIN_STYLES[0]!.style }, { onSuccess: () => toast.success('Style added') })}>New style</Button>}
      </div>
      {current && style && (
        <div className="space-y-3 max-w-xl">
          <label className="block"><span className="text-xs font-medium text-gray-600">Name</span><input disabled={!canEdit} className={`mt-0.5 ${input}`} value={name} onChange={(e) => setName(e.target.value)} /></label>
          <StylePanel style={style} onChange={setStyle} readOnly={!canEdit} library={undefined} onApplyPreset={setStyle} onSaveAsPreset={() => undefined} canManageLibrary={false} />
          {canEdit && (
            <div className="flex gap-2">
              <Button loading={save.isPending} onClick={() => save.mutate({ id: current.id, name, style }, { onSuccess: () => toast.success('Style saved'), onError: (e) => toast.error(isApiError(e) ? e.message : 'Save failed') })}>Save</Button>
              {!current.isDefault && <Button variant="secondary" onClick={() => save.mutate({ id: current.id, name, style, isDefault: true }, { onSuccess: () => toast.success('Default style updated') })}>Make default</Button>}
              {!current.builtinKey && <Button variant="ghost" onClick={() => del.mutate(current.id, { onSuccess: () => { setSelected(null); toast.info('Style deleted'); } })}><Trash2 className="h-4 w-4 mr-1 inline" />Delete</Button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TemplatesTab({ templates, canEdit }: { templates: Array<{ id: string; name: string; description: string | null; entityKind: string; isDefault: boolean }>; canEdit: boolean }) {
  const toast = useToast();
  const save = useSaveTemplate();
  const del = useDeleteTemplate();
  if (!templates.length) {
    return <p className="text-sm text-gray-500">No firm templates yet. Build a layout for one client, then use &ldquo;Save this layout as a firm template&rdquo; in the statement editor to reuse it for other clients.</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-gray-500"><tr><th className="py-2 font-medium">Name</th><th className="py-2 font-medium">Entity type</th><th className="py-2 font-medium" /></tr></thead>
      <tbody className="divide-y divide-gray-100">
        {templates.map((t) => (
          <tr key={t.id}>
            <td className="py-2">
              <input disabled={!canEdit} className="rounded border-transparent hover:border-gray-200 text-sm py-0.5 px-1" defaultValue={t.name}
                onBlur={(e) => e.target.value.trim() && e.target.value !== t.name && save.mutate({ id: t.id, name: e.target.value.trim() }, { onSuccess: () => toast.success('Renamed') })} />
              {t.isDefault && <Star className="h-3 w-3 inline ml-1 text-amber-500" />}
            </td>
            <td className="py-2 text-gray-600">{t.entityKind === 'any' ? 'Any' : t.entityKind}</td>
            <td className="py-2 text-right">
              {canEdit && (
                <button className="p-1 text-gray-400 hover:text-red-600" aria-label={`Delete ${t.name}`} onClick={() => del.mutate(t.id, { onSuccess: () => toast.info('Template deleted') })}><Trash2 className="h-4 w-4" /></button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
