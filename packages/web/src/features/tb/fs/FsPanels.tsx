// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Side panels of the financial-statement editor: statement settings
// (enable, title, page overrides, equity / cash-flow captions), style
// (font, sizes per element, numbers, page, footer), front matter (cover,
// contents, accountant's report), cash-flow classification and checks.

import { useMemo } from 'react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import {
  FS_DEFAULT_CF_CLASS_BY_CODE, FS_FONTS, FS_PAGE_NUMBER_FORMATS, FS_STYLE_ELEMENTS, fsDefaultCashFlowClass,
  type FsCashFlowClass, type FsCheck, type FsElementStyle, type FsFrontMatter, type FsPageSetup, type FsSourceData,
  type FsStatementConfig, type FsStyle, type FsStyleElement,
} from '@kis-books/shared';
import { RichTextEditor } from '../../admin/RichTextEditor';
import type { FsLibrary } from '../../../api/hooks/useFinancialStatements';

const input = 'w-full rounded-md border border-gray-300 px-2 text-sm py-1';

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <div className="mt-0.5">{children}</div>
      {hint && <span className="text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {children}
    </section>
  );
}

// ─── Statement settings ────────────────────────────────────────────

export function StatementSettingsPanel({ statement, onChange, readOnly }: { statement: FsStatementConfig; onChange: (s: FsStatementConfig) => void; readOnly: boolean }) {
  const ps = statement.pageSetup ?? {};
  const setPs = (p: Partial<FsPageSetup>) => {
    const next = { ...ps, ...p };
    for (const k of Object.keys(next) as Array<keyof FsPageSetup>) if (next[k] === undefined) delete next[k];
    onChange({ ...statement, pageSetup: Object.keys(next).length ? next : undefined });
  };
  return (
    <fieldset disabled={readOnly} className="space-y-3 text-sm">
      <label className="flex items-center gap-2"><input type="checkbox" checked={statement.enabled} onChange={(e) => onChange({ ...statement, enabled: e.target.checked })} />Include this statement</label>
      <Field label="Title" hint="Blank = the standard title for the basis and entity type">
        <input className={input} value={statement.titleOverride ?? ''} onChange={(e) => onChange({ ...statement, titleOverride: e.target.value || undefined })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Orientation">
          <select className={input} value={ps.orientation ?? ''} onChange={(e) => setPs({ orientation: (e.target.value || undefined) as FsPageSetup['orientation'] | undefined })}>
            <option value="">Document default</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option>
          </select>
        </Field>
        <Field label="Paper">
          <select className={input} value={ps.paper ?? ''} onChange={(e) => setPs({ paper: (e.target.value || undefined) as FsPageSetup['paper'] | undefined })}>
            <option value="">Document default</option><option value="letter">Letter</option><option value="legal">Legal</option><option value="a4">A4</option>
          </select>
        </Field>
      </div>

      {statement.kind === 'equity' && (
        <>
          <Field label="Columns">
            <select className={input} value={statement.equity?.columns ?? 'auto'} onChange={(e) => onChange({ ...statement, equity: { ...statement.equity, columns: e.target.value as 'auto' | 'single' | 'by_account' } })}>
              <option value="auto">Automatic (by account for corporations)</option>
              <option value="by_account">One column per equity account</option>
              <option value="single">Single column</option>
            </select>
          </Field>
          <CaptionGrid
            keys={[['beginning', 'Beginning balance'], ['netIncome', 'Net income'], ['contributions', 'Contributions'], ['distributions', 'Distributions'], ['other', 'Other changes'], ['ending', 'Ending balance'], ['total', 'Total column']]}
            values={statement.equity?.captions ?? {}}
            onChange={(captions) => onChange({ ...statement, equity: { ...statement.equity, captions } })}
          />
        </>
      )}

      {statement.kind === 'cash_flows' && (
        <>
          <label className="flex items-center gap-2"><input type="checkbox" checked={statement.cashFlow?.detailByAccount === true} onChange={(e) => onChange({ ...statement, cashFlow: { ...statement.cashFlow, detailByAccount: e.target.checked } })} />One line per account (instead of per leadsheet)</label>
          <CaptionGrid
            keys={[['operatingHeading', 'Operating heading'], ['netIncome', 'Net income'], ['netOperating', 'Net operating'], ['investingHeading', 'Investing heading'], ['netInvesting', 'Net investing'], ['financingHeading', 'Financing heading'], ['netFinancing', 'Net financing'], ['netChange', 'Net change in cash'], ['beginningCash', 'Beginning cash'], ['endingCash', 'Ending cash']]}
            values={statement.cashFlow?.captions ?? {}}
            onChange={(captions) => onChange({ ...statement, cashFlow: { ...statement.cashFlow, captions } })}
          />
        </>
      )}
    </fieldset>
  );
}

function CaptionGrid<K extends string>({ keys, values, onChange }: { keys: Array<[K, string]>; values: Partial<Record<K, string>>; onChange: (v: Partial<Record<K, string>>) => void }) {
  return (
    <details className="rounded border border-gray-200 p-2">
      <summary className="cursor-pointer text-xs font-medium text-gray-600">Captions</summary>
      <div className="mt-2 space-y-1.5">
        {keys.map(([k, label]) => (
          <Field key={k} label={label}>
            <input className={input} placeholder="Default" value={values[k] ?? ''} onChange={(e) => {
              const next = { ...values };
              if (e.target.value) next[k] = e.target.value; else delete next[k];
              onChange(next);
            }} />
          </Field>
        ))}
      </div>
    </details>
  );
}

// ─── Style ─────────────────────────────────────────────────────────

const ELEMENT_LABEL: Record<FsStyleElement, string> = {
  companyName: 'Company name', statementTitle: 'Statement title', dateLine: 'Date line', columnHeader: 'Column headings',
  sectionHeading: 'Section headings', detail: 'Detail lines', subtotal: 'Subtotals', total: 'Totals', text: 'Text / notes', footer: 'Footer',
};

export function StylePanel({ style, onChange, readOnly, library, onApplyPreset, onSaveAsPreset, canManageLibrary }: {
  style: FsStyle;
  onChange: (s: FsStyle) => void;
  readOnly: boolean;
  library: FsLibrary | undefined;
  onApplyPreset: (s: FsStyle) => void;
  onSaveAsPreset: () => void;
  canManageLibrary: boolean;
}) {
  const setEl = (k: FsStyleElement, p: Partial<FsElementStyle>) => onChange({ ...style, elements: { ...style.elements, [k]: { ...style.elements[k], ...p } } });
  const m = style.page.margins;
  return (
    <fieldset disabled={readOnly} className="space-y-5 text-sm">
      <Section title="Preset">
        <div className="flex gap-2">
          <select className={input} value="" onChange={(e) => {
            const p = library?.presets.find((x) => x.id === e.target.value);
            if (p) onApplyPreset(p.styleJson);
          }}>
            <option value="">Apply a firm style…</option>
            {(library?.presets ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {canManageLibrary && <button type="button" className="shrink-0 rounded-md border border-gray-300 px-2 text-xs hover:bg-gray-50" onClick={onSaveAsPreset}>Save as firm style</button>}
        </div>
      </Section>

      <Section title="Font">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Typeface">
            <select className={input} value={style.fontKey} onChange={(e) => onChange({ ...style, fontKey: e.target.value as FsStyle['fontKey'] })}>
              {FS_FONTS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </Field>
          <Field label="Base size (pt)"><input type="number" step={0.5} min={7} max={16} className={input} value={style.baseSizePt} onChange={(e) => onChange({ ...style, baseSizePt: Number(e.target.value) })} /></Field>
          <Field label="Line spacing"><input type="number" step={0.05} min={1} max={2.2} className={input} value={style.lineHeight} onChange={(e) => onChange({ ...style, lineHeight: Number(e.target.value) })} /></Field>
          <Field label="Indent step (pt)"><input type="number" min={4} max={36} className={input} value={style.indentPt} onChange={(e) => onChange({ ...style, indentPt: Number(e.target.value) })} /></Field>
        </div>
        <table className="w-full text-xs mt-2">
          <thead><tr className="text-gray-500"><th className="text-left font-medium">Element</th><th className="font-medium">Size</th><th className="font-medium">B</th><th className="font-medium">I</th><th className="font-medium">CAPS</th></tr></thead>
          <tbody>
            {FS_STYLE_ELEMENTS.map((k) => (
              <tr key={k}>
                <td className="py-0.5 text-gray-700">{ELEMENT_LABEL[k]}</td>
                <td className="py-0.5 w-16"><input type="number" step={0.5} min={6} max={28} className="w-14 rounded border border-gray-300 px-1 text-xs py-0.5" value={style.elements[k].sizePt} onChange={(e) => setEl(k, { sizePt: Number(e.target.value) })} aria-label={`${ELEMENT_LABEL[k]} size`} /></td>
                <td className="text-center"><input type="checkbox" checked={style.elements[k].bold} onChange={(e) => setEl(k, { bold: e.target.checked })} aria-label={`${ELEMENT_LABEL[k]} bold`} /></td>
                <td className="text-center"><input type="checkbox" checked={style.elements[k].italic} onChange={(e) => setEl(k, { italic: e.target.checked })} aria-label={`${ELEMENT_LABEL[k]} italic`} /></td>
                <td className="text-center"><input type="checkbox" checked={!!style.elements[k].caps} onChange={(e) => setEl(k, { caps: e.target.checked })} aria-label={`${ELEMENT_LABEL[k]} caps`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Field label="Title block">
          <select className={input} value={style.titleBlock.align} onChange={(e) => onChange({ ...style, titleBlock: { align: e.target.value as 'left' | 'center' } })}>
            <option value="center">Centered</option><option value="left">Left</option>
          </select>
        </Field>
      </Section>

      <Section title="Numbers">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Rounding">
            <select className={input} value={style.number.decimals} onChange={(e) => onChange({ ...style, number: { ...style.number, decimals: Number(e.target.value) as 0 | 2 } })}>
              <option value={0}>Whole dollars</option><option value={2}>Cents</option>
            </select>
          </Field>
          <Field label="Dollar signs">
            <select className={input} value={style.number.dollarSigns} onChange={(e) => onChange({ ...style, number: { ...style.number, dollarSigns: e.target.value as 'first_and_totals' | 'none' } })}>
              <option value="first_and_totals">First line &amp; totals</option><option value="none">None</option>
            </select>
          </Field>
          <Field label="Negatives">
            <select className={input} value={style.number.negative} onChange={(e) => onChange({ ...style, number: { ...style.number, negative: e.target.value as 'parens' | 'minus' } })}>
              <option value="parens">(1,234)</option><option value="minus">-1,234</option>
            </select>
          </Field>
          <Field label="Zero">
            <select className={input} value={style.number.zero} onChange={(e) => onChange({ ...style, number: { ...style.number, zero: e.target.value as 'dash' | 'zero' } })}>
              <option value="dash">—</option><option value="zero">0</option>
            </select>
          </Field>
          <Field label="Amount column width (in)"><input type="number" step={0.05} min={0.6} max={2.5} className={input} value={style.amountColumnWidthIn} onChange={(e) => onChange({ ...style, amountColumnWidthIn: Number(e.target.value) })} /></Field>
          <label className="flex items-end gap-1.5 text-xs pb-1.5"><input type="checkbox" checked={style.number.hideZeroLines} onChange={(e) => onChange({ ...style, number: { ...style.number, hideZeroLines: e.target.checked } })} />Hide zero lines</label>
        </div>
      </Section>

      <Section title="Page">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Paper">
            <select className={input} value={style.page.paper} onChange={(e) => onChange({ ...style, page: { ...style.page, paper: e.target.value as FsPageSetup['paper'] } })}>
              <option value="letter">Letter</option><option value="legal">Legal</option><option value="a4">A4</option>
            </select>
          </Field>
          <Field label="Orientation">
            <select className={input} value={style.page.orientation} onChange={(e) => onChange({ ...style, page: { ...style.page, orientation: e.target.value as FsPageSetup['orientation'] } })}>
              <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
            </select>
          </Field>
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <Field key={side} label={`${side[0]!.toUpperCase()}${side.slice(1)} margin (in)`}>
              <input type="number" step={0.05} min={0.25} max={3} className={input} value={m[side]} onChange={(e) => onChange({ ...style, page: { ...style.page, margins: { ...m, [side]: Number(e.target.value) } } })} />
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Footer">
        <Field label="Footer text"><input className={input} value={style.footer.text} onChange={(e) => onChange({ ...style, footer: { ...style.footer, text: e.target.value } })} /></Field>
        <div className="flex gap-4 text-xs">
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={style.footer.onStatements} onChange={(e) => onChange({ ...style, footer: { ...style.footer, onStatements: e.target.checked } })} />On statements</label>
          <label className="flex items-center gap-1.5"><input type="checkbox" checked={style.footer.onSchedules} onChange={(e) => onChange({ ...style, footer: { ...style.footer, onSchedules: e.target.checked } })} />On schedules</label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Page numbers">
            <select className={input} value={style.footer.pageNumber.format} onChange={(e) => onChange({ ...style, footer: { ...style.footer, pageNumber: { ...style.footer.pageNumber, format: e.target.value as FsStyle['footer']['pageNumber']['format'] } } })}>
              {FS_PAGE_NUMBER_FORMATS.map((f) => <option key={f} value={f}>{{ n: '3', dash_n: '- 3 -', page_n: 'Page 3', page_n_of_total: 'Page 3 of 9', none: 'None' }[f]}</option>)}
            </select>
          </Field>
          <Field label="Position">
            <select className={input} value={style.footer.pageNumber.position} onChange={(e) => onChange({ ...style, footer: { ...style.footer, pageNumber: { ...style.footer.pageNumber, position: e.target.value as 'bottom_center' | 'bottom_right' } } })}>
              <option value="bottom_center">Bottom center</option><option value="bottom_right">Bottom right</option>
            </select>
          </Field>
        </div>
      </Section>
    </fieldset>
  );
}

// ─── Front matter ──────────────────────────────────────────────────

const LETTER_VARS = [
  'client_name', 'firm_name', 'firm_city_state', 'accountant_signature', 'period_end_date', 'period_description',
  'basis_of_accounting', 'financial_statement_titles', 'report_date',
].map((key) => ({ key, label: key.replace(/_/g, ' ') }));

export function FrontMatterPanel({ value, onChange, readOnly, library }: { value: FsFrontMatter; onChange: (v: FsFrontMatter) => void; readOnly: boolean; library: FsLibrary | undefined }) {
  const letters = (library?.letters ?? []).filter((l) => l.isActive);
  const chosen = letters.find((l) => l.id === value.letter.letterId) ?? letters.find((l) => l.isDefault) ?? letters[0];
  return (
    <fieldset disabled={readOnly} className="space-y-5 text-sm">
      <Section title="Cover page">
        <label className="flex items-center gap-2"><input type="checkbox" checked={value.cover.enabled} onChange={(e) => onChange({ ...value, cover: { ...value.cover, enabled: e.target.checked } })} />Include a cover page</label>
        {value.cover.enabled && (
          <>
            <Field label="Title"><input className={input} value={value.cover.title ?? ''} placeholder="Financial Statements" onChange={(e) => onChange({ ...value, cover: { ...value.cover, title: e.target.value || undefined } })} /></Field>
            <Field label="Subtitle"><input className={input} value={value.cover.subtitle ?? ''} placeholder="(optional)" onChange={(e) => onChange({ ...value, cover: { ...value.cover, subtitle: e.target.value || undefined } })} /></Field>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={value.cover.showFirmName !== false} onChange={(e) => onChange({ ...value, cover: { ...value.cover, showFirmName: e.target.checked } })} />Show firm name</label>
          </>
        )}
      </Section>
      <Section title="Table of contents">
        <label className="flex items-center gap-2"><input type="checkbox" checked={value.toc.enabled} onChange={(e) => onChange({ ...value, toc: { ...value.toc, enabled: e.target.checked } })} />Include a table of contents</label>
      </Section>
      <Section title="Accountant's report">
        <label className="flex items-center gap-2"><input type="checkbox" checked={value.letter.enabled} onChange={(e) => onChange({ ...value, letter: { ...value.letter, enabled: e.target.checked } })} />Include the accountant&apos;s report</label>
        {value.letter.enabled && (
          <>
            <Field label="Report template">
              <select className={input} value={chosen?.id ?? ''} onChange={(e) => onChange({ ...value, letter: { ...value.letter, letterId: e.target.value || null, bodyHtmlOverride: null } })}>
                {letters.map((l) => <option key={l.id} value={l.id}>{l.name}{l.isDefault ? ' (default)' : ''}</option>)}
              </select>
            </Field>
            <Field label="Report date" hint="Blank = today"><input type="date" className={input} value={value.letter.reportDate ?? ''} onChange={(e) => onChange({ ...value, letter: { ...value.letter, reportDate: e.target.value || null } })} /></Field>
            <Field label="Title"><input className={input} placeholder={chosen?.title ?? "Accountant's Compilation Report"} value={value.letter.titleOverride ?? ''} onChange={(e) => onChange({ ...value, letter: { ...value.letter, titleOverride: e.target.value || null } })} /></Field>
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">Wording for this engagement</span>
                {value.letter.bodyHtmlOverride
                  ? <button type="button" className="text-xs text-primary-700 hover:underline" onClick={() => onChange({ ...value, letter: { ...value.letter, bodyHtmlOverride: null } })}>Use the template wording</button>
                  : <button type="button" className="text-xs text-primary-700 hover:underline" onClick={() => onChange({ ...value, letter: { ...value.letter, bodyHtmlOverride: chosen?.bodyHtml ?? '<p></p>' } })}>Customize for this client</button>}
              </div>
              {value.letter.bodyHtmlOverride !== null && value.letter.bodyHtmlOverride !== undefined && (
                <div className="mt-1">
                  <RichTextEditor value={value.letter.bodyHtmlOverride} onChange={(html) => onChange({ ...value, letter: { ...value.letter, bodyHtmlOverride: html } })} variables={LETTER_VARS} ariaLabel="Accountant's report wording" />
                </div>
              )}
            </div>
          </>
        )}
      </Section>
    </fieldset>
  );
}

// ─── Cash-flow classification ──────────────────────────────────────

const CF_LABEL: Record<FsCashFlowClass, string> = {
  cash: 'Cash', operating: 'Operating', noncash_adjustment: 'Noncash adjustment', investing: 'Investing', financing: 'Financing', excluded: 'Excluded',
};

export function CashFlowPanel({ source, overrides, onSet, readOnly }: {
  source: FsSourceData | undefined;
  overrides: Array<{ accountId: string | null; groupingId: string | null; classification: FsCashFlowClass }>;
  onSet: (o: { accountId?: string | null; groupingId?: string | null; classification: FsCashFlowClass | null }) => void;
  readOnly: boolean;
}) {
  const rows = useMemo(() => {
    if (!source) return [];
    const acct = new Map(source.accounts.map((a) => [a.id, a]));
    return source.groupings
      .map((g) => ({
        g,
        accounts: g.accountIds.map((id) => acct.get(id)).filter((a): a is NonNullable<typeof a> => !!a && ['asset', 'liability', 'equity'].includes(a.accountType)),
      }))
      .filter((x) => x.accounts.length);
  }, [source]);
  const byAccount = new Map(overrides.filter((o) => o.accountId).map((o) => [o.accountId!, o.classification]));
  const byGrouping = new Map(overrides.filter((o) => o.groupingId).map((o) => [o.groupingId!, o.classification]));
  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-gray-500">How each balance-sheet leadsheet and account moves into the statement of cash flows (indirect method). Accumulated depreciation is added back automatically.</p>
      {rows.map(({ g, accounts }) => {
        const gDefault = (g.code && FS_DEFAULT_CF_CLASS_BY_CODE[g.code]) || null;
        return (
          <div key={g.id} className="rounded border border-gray-200">
            <div className="flex items-center gap-2 bg-gray-50 px-2 py-1">
              <span className="flex-1 font-medium text-gray-800 truncate">{g.code ? `${g.code} — ` : ''}{g.name}</span>
              <select disabled={readOnly} className="rounded-md border border-gray-300 px-2 text-xs py-0.5" value={byGrouping.get(g.id) ?? ''} onChange={(e) => onSet({ groupingId: g.id, classification: (e.target.value || null) as FsCashFlowClass | null })}>
                <option value="">{gDefault ? `Default (${CF_LABEL[gDefault]})` : 'By account type'}</option>
                {Object.entries(CF_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <ul className="divide-y divide-gray-50">
              {accounts.map((a) => {
                const def = fsDefaultCashFlowClass(a, g.code);
                return (
                  <li key={a.id} className="flex items-center gap-2 px-2 py-0.5 text-xs">
                    <span className="flex-1 truncate text-gray-700">{a.number ? `${a.number} ` : ''}{a.name}</span>
                    <select disabled={readOnly} className="rounded-md border border-gray-300 px-2 text-xs py-0.5" value={byAccount.get(a.id) ?? ''} onChange={(e) => onSet({ accountId: a.id, classification: (e.target.value || null) as FsCashFlowClass | null })}>
                      <option value="">{byGrouping.get(g.id) ? 'Same as leadsheet' : `Default (${CF_LABEL[def]})`}</option>
                      {Object.entries(CF_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                    </select>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {!rows.length && <p className="text-xs text-gray-500">No balance-sheet leadsheets yet.</p>}
    </div>
  );
}

// ─── Checks ────────────────────────────────────────────────────────

export function ChecksPanel({ checks, onFocus }: { checks: FsCheck[]; onFocus: (c: FsCheck) => void }) {
  if (!checks.length) return <p className="text-sm text-green-700">Everything ties: the balance sheet balances, net income agrees with the ledger, every account with a balance is placed, and cash flows reconcile.</p>;
  const icon = (s: FsCheck['severity']) => s === 'error' ? <AlertCircle className="h-4 w-4 text-red-600 shrink-0" /> : s === 'warning' ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" /> : <Info className="h-4 w-4 text-blue-500 shrink-0" />;
  return (
    <ul className="space-y-2">
      {checks.map((c, i) => (
        <li key={i}>
          <button type="button" className="flex w-full items-start gap-2 rounded-md border border-gray-200 bg-white p-2 text-left text-sm hover:bg-gray-50" onClick={() => onFocus(c)}>
            {icon(c.severity)}
            <span className="text-gray-800">{c.message}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
