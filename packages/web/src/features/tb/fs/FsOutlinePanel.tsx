// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Small Business License 1.0.0.
// Free for small businesses; see LICENSE for terms.

// Outline editor for one balance sheet / income statement: a drag-and-drop
// tree of sections, leadsheet lines, pulled-out account lines, subtotals,
// text, blank lines and page breaks, with an inspector for the selected
// line (captions, summary vs detail vs schedule, rules, style, rounding
// plug) and a schedule editor (reorder, combine, split, pull out).

import { useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, FolderTree, GripVertical, Layers, ListPlus, Minus, Plus, Rows3, Scissors, Sigma, SplitSquareVertical, Trash2, Type, Undo2,
} from 'lucide-react';
import type {
  FsLeadsheetDisplay, FsNode, FsNodeRole, FsPolarity, FsRule, FsScheduleLine, FsSourceData, FsStatementConfig,
} from '@kis-books/shared';
import {
  allNodes, combineLines, deleteNodeFromStatement, effectiveScheduleLines, findNode, insertNode, moveLine, moveNode, newNodeId,
  splitLine, updateNode, type DropPosition,
} from './fsTreeOps';

type Props = {
  statement: FsStatementConfig;
  onChange: (st: FsStatementConfig) => void;
  source: FsSourceData | undefined;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  readOnly: boolean;
};

const TYPE_LABEL: Record<FsNode['type'], string> = {
  section: 'Section', leadsheet: 'Leadsheet', account: 'Account line', total: 'Total', text: 'Text', blank: 'Blank line', page_break: 'Page break',
};

const input = 'w-full rounded-md border border-gray-300 px-2 text-sm py-1';

export function FsOutlinePanel({ statement, onChange, source, selectedId, onSelect, readOnly }: Props) {
  const [drag, setDrag] = useState<{ id: string; over: string | null; pos: DropPosition } | null>(null);
  const flat = allNodes(statement.body);
  const groupingById = useMemo(() => new Map((source?.groupings ?? []).map((g) => [g.id, g])), [source]);
  const groupingByCode = useMemo(() => new Map((source?.groupings ?? []).filter((g) => g.code).map((g) => [g.code!, g])), [source]);
  const label = (n: FsNode): string => {
    if (n.type === 'section') return n.caption || '(section)';
    if (n.type === 'leadsheet') {
      const g = (n.ref.groupingId ? groupingById.get(n.ref.groupingId) : undefined) ?? (n.ref.leadsheetCode ? groupingByCode.get(n.ref.leadsheetCode) : undefined);
      return n.caption || g?.name || n.ref.leadsheetCode || 'Leadsheet';
    }
    if (n.type === 'account' || n.type === 'total') return n.caption;
    if (n.type === 'text') return n.text || '(text)';
    return TYPE_LABEL[n.type];
  };

  const setBody = (body: FsNode[]) => onChange({ ...statement, body });
  const add = (node: FsNode) => {
    const sel = selectedId ? findNode(statement.body, selectedId) : null;
    const pos: DropPosition = sel?.type === 'section' ? 'inside' : 'after';
    setBody(insertNode(statement.body, node, sel ? sel.id : null, sel ? pos : 'after'));
    onSelect(node.id);
  };
  const firstGrouping = source?.groupings[0];

  const onDragOver = (e: React.DragEvent, n: FsNode) => {
    if (!drag || readOnly) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    const pos: DropPosition = n.type === 'section' && y > 0.3 && y < 0.7 ? 'inside' : y < 0.5 ? 'before' : 'after';
    if (drag.over !== n.id || drag.pos !== pos) setDrag({ ...drag, over: n.id, pos });
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (drag?.over && drag.over !== drag.id) setBody(moveNode(statement.body, drag.id, drag.over, drag.pos));
    setDrag(null);
  };

  const selected = selectedId ? findNode(statement.body, selectedId) : null;

  return (
    <div className="flex flex-col gap-3">
      {!readOnly && (
        <div className="flex flex-wrap gap-1">
          <AddBtn icon={<FolderTree className="h-3.5 w-3.5" />} label="Section" onClick={() => add({ type: 'section', id: newNodeId('sec'), caption: 'New section', showHeading: true, showTotal: true, children: [] })} />
          <AddBtn icon={<Layers className="h-3.5 w-3.5" />} label="Leadsheet" onClick={() => firstGrouping && add({ type: 'leadsheet', id: newNodeId('ls'), ref: { groupingId: firstGrouping.id, leadsheetCode: firstGrouping.code ?? undefined }, display: 'single_line' })} />
          <AddBtn icon={<Rows3 className="h-3.5 w-3.5" />} label="Account line" onClick={() => add({ type: 'account', id: newNodeId('acct'), caption: 'New line', refs: [{ systemTag: 'retained_earnings' }] })} />
          <AddBtn icon={<Sigma className="h-3.5 w-3.5" />} label="Total" onClick={() => add({ type: 'total', id: newNodeId('tot'), caption: 'Total', terms: [], ruleAbove: 'single' })} />
          <AddBtn icon={<Type className="h-3.5 w-3.5" />} label="Text" onClick={() => add({ type: 'text', id: newNodeId('txt'), text: 'Text' })} />
          <AddBtn icon={<Minus className="h-3.5 w-3.5" />} label="Blank" onClick={() => add({ type: 'blank', id: newNodeId('blank') })} />
          <AddBtn icon={<SplitSquareVertical className="h-3.5 w-3.5" />} label="Page break" onClick={() => add({ type: 'page_break', id: newNodeId('pb') })} />
        </div>
      )}

      <ul className="rounded-md border border-gray-200 bg-white divide-y divide-gray-50 text-sm max-h-[45vh] overflow-y-auto" onDragLeave={() => drag && setDrag({ ...drag, over: null })}>
        {flat.map(({ node, depth }) => {
          const isSel = node.id === selectedId;
          const over = drag?.over === node.id;
          return (
            <li
              key={node.id}
              draggable={!readOnly}
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDrag({ id: node.id, over: null, pos: 'after' }); }}
              onDragEnd={() => setDrag(null)}
              onDragOver={(e) => onDragOver(e, node)}
              onDrop={onDrop}
              onClick={() => onSelect(node.id)}
              className={[
                'flex items-center gap-1.5 px-2 py-1 cursor-pointer select-none',
                isSel ? 'bg-primary-50' : 'hover:bg-gray-50',
                over && drag?.pos === 'before' ? 'border-t-2 border-t-primary-500' : '',
                over && drag?.pos === 'after' ? 'border-b-2 border-b-primary-500' : '',
                over && drag?.pos === 'inside' ? 'ring-2 ring-inset ring-primary-400' : '',
              ].join(' ')}
              style={{ paddingLeft: 8 + depth * 16 }}
            >
              {!readOnly && <GripVertical className="h-3.5 w-3.5 text-gray-300 shrink-0" aria-hidden />}
              <span className={`truncate ${node.type === 'section' ? 'font-semibold text-gray-900' : node.type === 'total' ? 'font-medium text-gray-800' : 'text-gray-700'}`}>
                {node.type === 'total' ? '= ' : ''}{label(node)}
              </span>
              <span className="ml-auto flex items-center gap-1 shrink-0">
                {node.type === 'leadsheet' && node.display !== 'single_line' && (
                  <span className="rounded bg-gray-100 px-1.5 text-[10px] uppercase tracking-wide text-gray-600">{node.display === 'detail' ? 'detail' : 'schedule'}</span>
                )}
                {(node.type === 'section' || node.type === 'total') && node.role && <span className="rounded bg-blue-50 px-1.5 text-[10px] uppercase text-blue-700">check</span>}
                {node.type === 'page_break' && <span className="text-[10px] text-gray-400">— new page —</span>}
                {!readOnly && (
                  <button
                    type="button" aria-label={`Delete ${label(node)}`} className="p-0.5 text-gray-300 hover:text-red-600"
                    onClick={(e) => { e.stopPropagation(); onChange(deleteNodeFromStatement(statement, node.id)); if (isSel) onSelect(null); }}
                  ><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </span>
            </li>
          );
        })}
        {!flat.length && <li className="px-3 py-6 text-center text-gray-500">No lines yet — add a section or leadsheet.</li>}
      </ul>

      {selected && (
        <NodeInspector
          key={selected.id}
          node={selected}
          statement={statement}
          source={source}
          readOnly={readOnly}
          onPatch={(fn) => setBody(updateNode(statement.body, selected.id, fn))}
          onStatement={onChange}
          label={label}
        />
      )}
    </div>
  );
}

function AddBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
      <Plus className="h-3 w-3 text-gray-400" />{icon}{label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <div className="mt-0.5">{children}</div>
    </label>
  );
}

type Tri = boolean | undefined;
function TriSelect({ value, onChange, disabled }: { value: Tri; onChange: (v: Tri) => void; disabled?: boolean }) {
  return (
    <select className={input} disabled={disabled} value={value === undefined ? '' : value ? '1' : '0'} onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === '1')}>
      <option value="">Default</option>
      <option value="1">Yes</option>
      <option value="0">No</option>
    </select>
  );
}

function NodeInspector({ node, statement, source, readOnly, onPatch, onStatement, label }: {
  node: FsNode;
  statement: FsStatementConfig;
  source: FsSourceData | undefined;
  readOnly: boolean;
  onPatch: (fn: (n: FsNode) => FsNode) => void;
  onStatement: (st: FsStatementConfig) => void;
  label: (n: FsNode) => string;
}) {
  const patch = <T extends FsNode>(p: Partial<T>) => onPatch((n) => ({ ...n, ...p }) as FsNode);
  const style = node.style ?? {};
  const setStyle = (p: Partial<NonNullable<FsNode['style']>>) => {
    const next = { ...style, ...p };
    for (const k of Object.keys(next) as Array<keyof typeof next>) if (next[k] === undefined) delete next[k];
    patch({ style: Object.keys(next).length ? next : undefined });
  };
  const isAnchor = (node.type === 'section' || node.type === 'total') && (!!node.role || !!(node as { anchor?: boolean }).anchor);
  const leafOptions = allNodes(statement.body).map((x) => x.node).filter((n) => n.type === 'leadsheet' || n.type === 'account');
  const termOptions = allNodes(statement.body).map((x) => x.node).filter((n) => n.id !== node.id && (n.type === 'section' || n.type === 'leadsheet' || n.type === 'account' || n.type === 'total'));

  return (
    <fieldset disabled={readOnly} className="rounded-md border border-gray-200 bg-gray-50 p-3 space-y-3 text-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{TYPE_LABEL[node.type]}</div>

      {node.type === 'section' && (
        <>
          <Field label="Heading"><input className={input} value={node.caption} onChange={(e) => patch({ caption: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={node.showHeading !== false} onChange={(e) => patch({ showHeading: e.target.checked })} />Show heading</label>
            <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={node.showTotal !== false} onChange={(e) => patch({ showTotal: e.target.checked })} />Show total</label>
          </div>
          {node.showTotal !== false && <Field label="Total caption"><input className={input} placeholder={`Total ${node.caption.toLowerCase()}`} value={node.totalCaption ?? ''} onChange={(e) => patch({ totalCaption: e.target.value || undefined })} /></Field>}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Amounts shown as">
              <PolaritySelect value={node.polarity} onChange={(polarity) => patch({ polarity })} />
            </Field>
            <Field label="Checked as">
              <RoleSelect value={node.role} onChange={(role) => patch({ role })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Rule above total"><RuleSelect single value={node.totalRuleAbove ?? 'single'} onChange={(v) => patch({ totalRuleAbove: v as 'none' | 'single' })} /></Field>
            <Field label="Rule below total"><RuleSelect value={node.totalRuleBelow ?? 'none'} onChange={(v) => patch({ totalRuleBelow: v })} /></Field>
          </div>
        </>
      )}

      {node.type === 'leadsheet' && (
        <>
          <Field label="Leadsheet">
            <select className={input} value={node.ref.groupingId ?? ''} onChange={(e) => {
              const g = source?.groupings.find((x) => x.id === e.target.value);
              patch({ ref: { groupingId: e.target.value, leadsheetCode: g?.code ?? undefined }, scheduleLines: undefined });
            }}>
              {!node.ref.groupingId && <option value="">{node.ref.leadsheetCode ? `Code ${node.ref.leadsheetCode} (not linked)` : 'Choose…'}</option>}
              {(source?.groupings ?? []).map((g) => <option key={g.id} value={g.id}>{g.code ? `${g.code} — ` : ''}{g.name}</option>)}
            </select>
          </Field>
          <Field label="Caption"><input className={input} placeholder="Leadsheet name" value={node.caption ?? ''} onChange={(e) => patch({ caption: e.target.value || undefined })} /></Field>
          <Field label="Show as">
            <select className={input} value={node.display} onChange={(e) => patch({ display: e.target.value as FsLeadsheetDisplay })}>
              <option value="single_line">One summary line</option>
              <option value="detail">Detail — every account on the statement</option>
              <option value="summary_with_schedule">Summary line + supporting schedule</option>
            </select>
          </Field>
          {node.display === 'summary_with_schedule' && (
            <Field label="Schedule title"><input className={input} placeholder={`Schedule of ${label(node)}`} value={node.scheduleTitle ?? ''} onChange={(e) => patch({ scheduleTitle: e.target.value || undefined })} /></Field>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Amounts shown as"><PolaritySelect value={node.polarity} onChange={(polarity) => patch({ polarity })} /></Field>
            <label className="flex items-end gap-1.5 text-xs pb-1.5"><input type="checkbox" checked={!!node.revenueBase} onChange={(e) => patch({ revenueBase: e.target.checked || undefined })} />Base for % of revenue</label>
          </div>
          {node.display !== 'single_line' && source && (
            <ScheduleEditor node={node} source={source} readOnly={readOnly}
              onLines={(scheduleLines) => patch({ scheduleLines })}
              onPullOut={(accountId, caption) => {
                const acct: FsNode = { type: 'account', id: newNodeId('acct'), refs: [{ accountId }], caption, polarity: node.polarity };
                onStatement({ ...statement, body: insertNode(statement.body, acct, node.id, 'after') });
              }}
            />
          )}
        </>
      )}

      {node.type === 'account' && (
        <>
          <Field label="Caption"><input className={input} value={node.caption} onChange={(e) => patch({ caption: e.target.value })} /></Field>
          <Field label="Accounts on this line">
            <AccountRefsEditor refs={node.refs} source={source} onChange={(refs) => patch({ refs })} />
          </Field>
          <Field label="Amounts shown as"><PolaritySelect value={node.polarity} onChange={(polarity) => patch({ polarity })} /></Field>
        </>
      )}

      {node.type === 'total' && (
        <>
          <Field label="Caption"><input className={input} value={node.caption} onChange={(e) => patch({ caption: e.target.value })} /></Field>
          <Field label="Adds up">
            <div className="space-y-1">
              {node.terms.map((t, i) => (
                <div key={i} className="flex items-center gap-1">
                  <select className="rounded-md border border-gray-300 px-2 text-sm py-1 w-14" value={t.sign} onChange={(e) => patch({ terms: node.terms.map((x, j) => (j === i ? { ...x, sign: Number(e.target.value) as 1 | -1 } : x)) })}>
                    <option value={1}>+</option><option value={-1}>−</option>
                  </select>
                  <select className={input} value={t.nodeId} onChange={(e) => patch({ terms: node.terms.map((x, j) => (j === i ? { ...x, nodeId: e.target.value } : x)) })}>
                    {!termOptions.some((o) => o.id === t.nodeId) && <option value={t.nodeId}>(missing line)</option>}
                    {termOptions.map((o) => <option key={o.id} value={o.id}>{label(o)}</option>)}
                  </select>
                  <button type="button" className="p-1 text-gray-400 hover:text-red-600" aria-label="Remove" onClick={() => patch({ terms: node.terms.filter((_, j) => j !== i) })}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {termOptions[0] && (
                <button type="button" className="text-xs text-primary-700 hover:underline" onClick={() => patch({ terms: [...node.terms, { nodeId: termOptions[0]!.id, sign: 1 }] })}>+ Add line</button>
              )}
            </div>
          </Field>
          <Field label="Checked as"><RoleSelect value={node.role} onChange={(role) => patch({ role })} /></Field>
        </>
      )}

      {node.type === 'text' && (
        <Field label="Text"><textarea className={`${input} min-h-[60px]`} value={node.text} onChange={(e) => patch({ text: e.target.value })} /></Field>
      )}

      {node.type !== 'blank' && node.type !== 'page_break' && (
        <details className="rounded border border-gray-200 bg-white p-2">
          <summary className="cursor-pointer text-xs font-medium text-gray-600">Line format</summary>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <Field label="Bold"><TriSelect value={style.bold} onChange={(bold) => setStyle({ bold })} /></Field>
            <Field label="Italic"><TriSelect value={style.italic} onChange={(italic) => setStyle({ italic })} /></Field>
            <Field label="All caps"><TriSelect value={style.caps} onChange={(caps) => setStyle({ caps })} /></Field>
            <Field label="Extra indent"><input type="number" min={-4} max={6} className={input} value={style.indent ?? 0} onChange={(e) => setStyle({ indent: Number(e.target.value) || undefined })} /></Field>
            <Field label="Size +/− pt"><input type="number" min={-4} max={8} step={0.5} className={input} value={style.sizeDelta ?? 0} onChange={(e) => setStyle({ sizeDelta: Number(e.target.value) || undefined })} /></Field>
            <Field label="Hide when zero"><TriSelect value={node.hideWhenZero} onChange={(hideWhenZero) => patch({ hideWhenZero })} /></Field>
            {node.type !== 'section' && (
              <>
                <Field label="Rule above"><RuleSelect single value={node.ruleAbove ?? 'none'} onChange={(v) => patch({ ruleAbove: v === 'none' ? undefined : (v as 'single') })} /></Field>
                <Field label="Rule below"><RuleSelect value={node.ruleBelow ?? 'none'} onChange={(v) => patch({ ruleBelow: v === 'none' ? undefined : v })} /></Field>
              </>
            )}
            <label className="flex items-end gap-1.5 text-xs pb-1.5"><input type="checkbox" checked={!!node.breakBefore} onChange={(e) => patch({ breakBefore: e.target.checked || undefined })} />New page before</label>
          </div>
        </details>
      )}

      {isAnchor && (
        <Field label="Rounding goes to">
          <select className={input} value={statement.plugs?.[node.id] ?? ''} onChange={(e) => {
            const plugs = { ...(statement.plugs ?? {}) };
            if (e.target.value) plugs[node.id] = e.target.value; else delete plugs[node.id];
            onStatement({ ...statement, plugs });
          }}>
            <option value="">Largest line (never cash)</option>
            {leafOptions.map((o) => <option key={o.id} value={o.id}>{label(o)}</option>)}
          </select>
        </Field>
      )}
    </fieldset>
  );
}

function PolaritySelect({ value, onChange }: { value: FsPolarity | undefined; onChange: (v: FsPolarity | undefined) => void }) {
  return (
    <select className={input} value={value ?? ''} onChange={(e) => onChange((e.target.value || undefined) as FsPolarity | undefined)}>
      <option value="">Automatic</option>
      <option value="debit">Debits positive (assets, expenses)</option>
      <option value="credit">Credits positive (liabilities, equity, revenue)</option>
    </select>
  );
}

function RoleSelect({ value, onChange }: { value: FsNodeRole | undefined; onChange: (v: FsNodeRole | undefined) => void }) {
  return (
    <select className={input} value={value ?? ''} onChange={(e) => onChange((e.target.value || undefined) as FsNodeRole | undefined)}>
      <option value="">—</option>
      <option value="total_assets">Total assets</option>
      <option value="total_liabilities_equity">Total liabilities &amp; equity</option>
      <option value="net_income">Net income</option>
    </select>
  );
}

function RuleSelect({ value, onChange, single }: { value: FsRule; onChange: (v: FsRule) => void; single?: boolean }) {
  return (
    <select className={input} value={value} onChange={(e) => onChange(e.target.value as FsRule)}>
      <option value="none">None</option>
      <option value="single">Single</option>
      {!single && <option value="double">Double</option>}
    </select>
  );
}

function AccountRefsEditor({ refs, source, onChange }: { refs: Array<{ accountId?: string; systemTag?: string }>; source: FsSourceData | undefined; onChange: (r: Array<{ accountId?: string; systemTag?: string }>) => void }) {
  const accounts = [...(source?.accounts ?? [])].sort((a, b) => (a.number ?? '').localeCompare(b.number ?? '', undefined, { numeric: true }));
  return (
    <div className="space-y-1">
      {refs.map((r, i) => (
        <div key={i} className="flex gap-1">
          <select className={input} value={r.accountId ?? `tag:${r.systemTag}`} onChange={(e) => {
            const v = e.target.value;
            onChange(refs.map((x, j) => (j === i ? (v.startsWith('tag:') ? { systemTag: v.slice(4) } : { accountId: v }) : x)));
          }}>
            <option value="tag:retained_earnings">Retained earnings (system)</option>
            {accounts.filter((a) => !a.isVirtual).map((a) => <option key={a.id} value={a.id}>{a.number ? `${a.number} ` : ''}{a.name}</option>)}
          </select>
          {refs.length > 1 && <button type="button" className="p-1 text-gray-400 hover:text-red-600" aria-label="Remove account" onClick={() => onChange(refs.filter((_, j) => j !== i))}><Trash2 className="h-3.5 w-3.5" /></button>}
        </div>
      ))}
      <button type="button" className="text-xs text-primary-700 hover:underline" onClick={() => onChange([...refs, { accountId: accounts.find((a) => !a.isVirtual)?.id }])}>+ Add account</button>
    </div>
  );
}

function ScheduleEditor({ node, source, readOnly, onLines, onPullOut }: {
  node: Extract<FsNode, { type: 'leadsheet' }>;
  source: FsSourceData;
  readOnly: boolean;
  onLines: (lines: FsScheduleLine[] | undefined) => void;
  onPullOut: (accountId: string, caption: string) => void;
}) {
  const [sel, setSel] = useState<Set<number>>(new Set());
  const g = (node.ref.groupingId ? source.groupings.find((x) => x.id === node.ref.groupingId) : undefined)
    ?? (node.ref.leadsheetCode ? source.groupings.find((x) => x.code === node.ref.leadsheetCode) : undefined) ?? null;
  const acctById = new Map(source.accounts.map((a) => [a.id, a]));
  const order = (a: string, b: string) => (acctById.get(a)?.number ?? '').localeCompare(acctById.get(b)?.number ?? '', undefined, { numeric: true });
  const cy = source.workpapers[source.periodEnd]?.balances ?? {};
  const ids = (g?.accountIds ?? []).filter((id) => {
    const t = acctById.get(id)?.accountType;
    return !!t;
  });
  const lines = effectiveScheduleLines(node.scheduleLines, ids, order);
  const amount = (l: FsScheduleLine) => l.accountRefs.reduce((s, r) => s + (r.accountId ? cy[r.accountId] ?? 0 : 0), 0);
  const capOf = (l: FsScheduleLine) => l.caption || (l.accountRefs.length === 1 && l.accountRefs[0]!.accountId ? acctById.get(l.accountRefs[0]!.accountId)?.name ?? 'Account' : 'Combined');
  const commit = (next: FsScheduleLine[]) => { onLines(next); setSel(new Set()); };
  if (!g) return <p className="text-xs text-amber-700">Link this line to a leadsheet to edit its accounts.</p>;
  return (
    <div className="rounded border border-gray-200 bg-white">
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-100">
        <span className="text-xs font-medium text-gray-600">Accounts ({node.display === 'detail' ? 'shown on the statement' : 'on the schedule'})</span>
        {!readOnly && (
          <div className="flex gap-1">
            <button type="button" disabled={sel.size < 2} className="inline-flex items-center gap-1 rounded border border-gray-200 px-1.5 py-0.5 text-xs disabled:opacity-40"
              onClick={() => {
                const caption = window.prompt('Caption for the combined line', 'Combined');
                if (caption) commit(combineLines(lines, [...sel], caption));
              }}><ListPlus className="h-3 w-3" />Combine</button>
            {node.scheduleLines?.length ? (
              <button type="button" className="inline-flex items-center gap-1 rounded border border-gray-200 px-1.5 py-0.5 text-xs" onClick={() => commit([])} title="Back to one line per account, by number"><Undo2 className="h-3 w-3" />Reset</button>
            ) : null}
          </div>
        )}
      </div>
      <ul className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
        {lines.map((l, i) => (
          <li key={l.id} className="flex items-center gap-1.5 px-2 py-1 text-xs">
            {!readOnly && <input type="checkbox" checked={sel.has(i)} onChange={(e) => { const s = new Set(sel); if (e.target.checked) s.add(i); else s.delete(i); setSel(s); }} aria-label={`Select ${capOf(l)}`} />}
            <input
              className="flex-1 min-w-0 rounded border-transparent hover:border-gray-200 focus:border-gray-300 text-xs py-0.5 px-1"
              value={capOf(l)} disabled={readOnly}
              onChange={(e) => commit(lines.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))}
            />
            {l.accountRefs.length > 1 && <span className="text-gray-400">{l.accountRefs.length} accts</span>}
            <span className="w-20 text-right tabular-nums text-gray-600">{amount(l).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            {!readOnly && (
              <span className="flex">
                <button type="button" className="p-0.5 text-gray-400 hover:text-gray-700" aria-label="Move up" onClick={() => commit(moveLine(lines, i, -1))}><ArrowUp className="h-3 w-3" /></button>
                <button type="button" className="p-0.5 text-gray-400 hover:text-gray-700" aria-label="Move down" onClick={() => commit(moveLine(lines, i, 1))}><ArrowDown className="h-3 w-3" /></button>
                {l.accountRefs.length > 1 && <button type="button" className="p-0.5 text-gray-400 hover:text-gray-700" aria-label="Split" title="Split into one line per account" onClick={() => commit(splitLine(lines, i))}><Scissors className="h-3 w-3" /></button>}
                {l.accountRefs.length === 1 && l.accountRefs[0]!.accountId && (
                  <button type="button" className="p-0.5 text-gray-400 hover:text-primary-700" title="Show this account as its own line on the statement"
                    onClick={() => onPullOut(l.accountRefs[0]!.accountId!, capOf(l))}><FolderTree className="h-3 w-3" /></button>
                )}
              </span>
            )}
          </li>
        ))}
        {!lines.length && <li className="px-2 py-3 text-xs text-gray-500">No accounts in this leadsheet.</li>}
      </ul>
    </div>
  );
}
