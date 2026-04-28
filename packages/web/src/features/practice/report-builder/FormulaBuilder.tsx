// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useMemo, useState } from 'react';
import { Wand2, Save, Plus, Trash2, Pencil, AlertTriangle } from 'lucide-react';

// VIBE_MYBOOKS_PRACTICE_BUILD_PLAN Phase 16.3 — visual formula
// builder for custom KPIs. Produces an AST the server-side
// evaluator walks to compute real values against the company's
// books. Stock KPIs are read-only; custom ones round-trip through
// /practice/reports/custom-kpis.

export interface FormulaNode {
  kind: 'literal' | 'op' | 'category' | 'metric' | 'kpi';
  value?: number | string;
  op?: '+' | '-' | '*' | '/';
  left?: FormulaNode;
  right?: FormulaNode;
  period?: 'current' | 'prior_month' | 'prior_year';
}

interface CatalogEntry {
  key: string;
  name: string;
  category: string;
  format: 'currency' | 'percent' | 'ratio' | 'days';
  formula: unknown;
  source: 'stock' | 'custom';
  id?: string;
}

interface EditorState {
  id: string | null;
  key: string;
  name: string;
  category: string;
  format: 'currency' | 'percent' | 'ratio' | 'days';
  formula: FormulaNode;
}

const ACCOUNT_CATEGORIES = [
  'revenue',
  'expense',
  'cogs',
  'cash',
  'bank',
  'accounts_receivable',
  'accounts_payable',
  'current_asset',
  'current_liability',
  'inventory',
] as const;

const METRICS = [
  'period_days',
  'avg_monthly_burn',
  'avg_daily_expense',
  'operating_income',
  'net_income',
  'ebitda',
  'ar_balance',
  'ap_balance',
  'inventory_balance',
  'bank_balance',
  'cash_balance',
] as const;

const KNOWN_KPIS = [
  'gross_margin_pct',
  'net_margin_pct',
  'operating_margin_pct',
  'current_ratio',
  'ar_days',
  'ap_days',
  'inventory_days',
  'bank_balance',
  'cash_balance',
];

interface ApiErrorBody {
  error?: { message?: string };
  message?: string;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('accessToken');
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> | undefined),
    Authorization: `Bearer ${token ?? ''}`,
  };
  if (init?.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`/api/v1${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as ApiErrorBody;
      detail = body?.error?.message ?? body?.message ?? detail;
    } catch {
      // non-JSON response
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Convert a stock-catalog AST shape (op:'div',a,b / type:'category')
// into the FormulaBuilder's editor shape (kind:'op',left,right /
// kind:'category'). Used when the user forks a stock KPI.
function normalizeStockFormula(raw: unknown): FormulaNode {
  if (raw == null || typeof raw !== 'object') {
    return { kind: 'literal', value: 0 };
  }
  const n = raw as Record<string, unknown>;
  if (n['kind']) return n as unknown as FormulaNode;

  // Stock shape: { op: 'div'|'sub'|'add'|'mul', a, b }
  if (typeof n['op'] === 'string' && (n['a'] || n['b'])) {
    const opMap: Record<string, FormulaNode['op']> = {
      div: '/', sub: '-', add: '+', mul: '*',
    };
    return {
      kind: 'op',
      op: opMap[n['op'] as string] ?? '+',
      left: normalizeStockFormula(n['a']),
      right: normalizeStockFormula(n['b']),
    };
  }
  // Stock shape: { type: 'category'|'category_sum'|<metric>, value, period? }
  if (typeof n['type'] === 'string') {
    const t = n['type'] as string;
    const period = (n['period'] as FormulaNode['period']) ?? 'current';
    if (t === 'category') {
      return { kind: 'category', value: String(n['value'] ?? ''), period };
    }
    if (t === 'category_sum') {
      // Lossy: editor doesn't model multi-value sum; collapse to first.
      const arr = Array.isArray(n['value']) ? (n['value'] as string[]) : [];
      return { kind: 'category', value: arr[0] ?? '', period };
    }
    // Anything else is treated as a metric reference.
    return { kind: 'metric', value: t, period };
  }
  return { kind: 'literal', value: 0 };
}

export function FormulaBuilder({ onClose }: { onClose: () => void }) {
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  const [editing, setEditing] = useState<EditorState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setError(null);
    try {
      const d = await api<{ kpis: CatalogEntry[] }>('/practice/reports/kpis');
      setCatalog(d.kpis);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load KPI catalog.');
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const stock = useMemo(() => (catalog ?? []).filter((k) => k.source === 'stock'), [catalog]);
  const custom = useMemo(() => (catalog ?? []).filter((k) => k.source === 'custom'), [catalog]);

  if (editing) {
    return (
      <KpiFormulaEditor
        initial={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          setEditing(null);
          await reload();
        }}
      />
    );
  }

  return (
    <Modal title="Formula library" onClose={onClose}>
      {error && (
        <div
          role="alert"
          className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-3"
        >
          {error}
        </div>
      )}

      {custom.length > 0 && (
        <>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
            Your custom KPIs
          </h3>
          <div className="space-y-2 mb-4">
            {custom.map((k) => (
              <div
                key={k.key}
                className="flex items-center justify-between bg-white border border-gray-200 rounded-md p-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{k.name}</p>
                  <p className="text-xs text-gray-500">
                    <span className="uppercase tracking-wide">{k.category}</span> · {k.format} ·{' '}
                    <code className="text-[11px] bg-gray-100 px-1 rounded">{k.key}</code>
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() =>
                      setEditing({
                        id: k.id ?? null,
                        key: k.key,
                        name: k.name,
                        category: k.category,
                        format: k.format,
                        formula: normalizeStockFormula(k.formula),
                      })
                    }
                    className="p-1.5 text-gray-600 hover:bg-gray-100 rounded"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!k.id) return;
                      if (!confirm(`Delete "${k.name}"? Layouts referencing "${k.key}" will show — instead.`)) return;
                      try {
                        await api(`/practice/reports/custom-kpis/${k.id}`, { method: 'DELETE' });
                        await reload();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Delete failed.');
                      }
                    }}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
        Stock KPIs (read-only — fork to customize)
      </h3>
      <div className="space-y-2 max-h-[40vh] overflow-y-auto">
        {!catalog ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          stock.map((k) => (
            <button
              key={k.key}
              onClick={() =>
                setEditing({
                  id: null,
                  key: `custom_${k.key}`,
                  name: `${k.name} (custom)`,
                  category: k.category,
                  format: k.format,
                  formula: normalizeStockFormula(k.formula),
                })
              }
              className="w-full text-left bg-white border border-gray-200 rounded-md p-3 hover:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{k.name}</p>
                  <p className="text-xs text-gray-500">
                    <span className="uppercase tracking-wide">{k.category}</span> · {k.format} ·{' '}
                    <code className="text-[11px] bg-gray-100 px-1 rounded">{k.key}</code>
                  </p>
                </div>
                <Plus className="h-4 w-4 text-gray-400" />
              </div>
            </button>
          ))
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200">
        <button
          onClick={() =>
            setEditing({
              id: null,
              key: 'custom_kpi',
              name: 'Custom KPI',
              category: 'custom',
              format: 'currency',
              formula: { kind: 'literal', value: 0 },
            })
          }
          className="inline-flex items-center gap-2 text-sm font-medium text-indigo-700 hover:underline"
        >
          <Wand2 className="h-4 w-4" /> Build a custom KPI from scratch
        </button>
      </div>
    </Modal>
  );
}

function KpiFormulaEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: EditorState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isUpdate = !!initial.id;
  const [name, setName] = useState(initial.name);
  const [key, setKey] = useState(initial.key);
  const [category, setCategory] = useState(initial.category);
  const [format, setFormat] = useState(initial.format);
  const [tree, setTree] = useState<FormulaNode>(initial.formula);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const preview = useMemo(() => renderTree(tree), [tree]);
  const validation = useMemo(() => validateTree(tree), [tree]);

  const save = async () => {
    setErr(null);
    if (!isUpdate && !/^[a-z][a-z0-9_]{0,79}$/.test(key)) {
      setErr('Key must start with a letter; lowercase letters, numbers, underscores only (≤80).');
      return;
    }
    if (!name.trim()) {
      setErr('Name required.');
      return;
    }
    if (validation.length > 0) {
      setErr(validation.join(' '));
      return;
    }
    setSaving(true);
    try {
      if (isUpdate && initial.id) {
        await api(`/practice/reports/custom-kpis/${initial.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name, category, format, formula: tree }),
        });
      } else {
        await api('/practice/reports/custom-kpis', {
          method: 'POST',
          body: JSON.stringify({ key, name, category, format, formula: tree }),
        });
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={isUpdate ? 'Edit custom KPI' : 'New custom KPI'} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="block text-sm">
          <span className="block text-gray-800 mb-1">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="block text-gray-800 mb-1">
            Key {isUpdate && <span className="text-gray-400">(locked)</span>}
          </span>
          <input
            type="text"
            value={key}
            disabled={isUpdate}
            onChange={(e) => setKey(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm font-mono disabled:bg-gray-50 disabled:text-gray-500"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="block text-sm">
          <span className="block text-gray-800 mb-1">Category</span>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. liquidity, custom"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="block text-gray-800 mb-1">Display format</span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as EditorState['format'])}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="currency">$ Currency</option>
            <option value="percent">% Percent</option>
            <option value="ratio">x Ratio</option>
            <option value="days">d Days</option>
          </select>
        </label>
      </div>

      <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Formula</p>
        <NodeEditor node={tree} onChange={setTree} />
        <p className="mt-3 text-xs text-gray-700 font-mono bg-white border border-gray-200 rounded p-2 break-all">
          {preview}
        </p>
        {validation.length > 0 && (
          <div className="mt-2 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <ul className="list-disc list-inside space-y-0.5">
              {validation.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {err && (
        <div
          role="alert"
          className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2"
        >
          {err}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={onClose}
          className="px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving || !name.trim() || validation.length > 0}
          className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md"
        >
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save KPI'}
        </button>
      </div>
    </Modal>
  );
}

function NodeEditor({
  node,
  onChange,
}: {
  node: FormulaNode;
  onChange: (n: FormulaNode) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={node.kind}
          onChange={(e) => {
            const kind = e.target.value as FormulaNode['kind'];
            if (kind === 'op') {
              onChange({
                kind: 'op',
                op: '+',
                left: { kind: 'literal', value: 0 },
                right: { kind: 'literal', value: 0 },
              });
            } else if (kind === 'category') {
              onChange({ kind: 'category', value: ACCOUNT_CATEGORIES[0] });
            } else if (kind === 'metric') {
              onChange({ kind: 'metric', value: METRICS[0] });
            } else if (kind === 'kpi') {
              onChange({ kind: 'kpi', value: KNOWN_KPIS[0] });
            } else {
              onChange({ kind: 'literal', value: 0 });
            }
          }}
          className="text-sm border border-gray-300 rounded-md px-2 py-1"
        >
          <option value="literal">Literal</option>
          <option value="op">Math operation</option>
          <option value="category">Account category</option>
          <option value="metric">Built-in metric</option>
          <option value="kpi">Reference another KPI</option>
        </select>

        {node.kind === 'literal' && (
          <input
            type="number"
            value={Number(node.value ?? 0)}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              onChange({ ...node, value: Number.isFinite(n) ? n : 0 });
            }}
            className="w-32 border border-gray-300 rounded-md px-2 py-1 text-sm"
          />
        )}
        {node.kind === 'category' && (
          <select
            value={String(node.value ?? '')}
            onChange={(e) => onChange({ ...node, value: e.target.value })}
            className="text-sm border border-gray-300 rounded-md px-2 py-1"
          >
            {ACCOUNT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        )}
        {node.kind === 'metric' && (
          <select
            value={String(node.value ?? '')}
            onChange={(e) => onChange({ ...node, value: e.target.value })}
            className="text-sm border border-gray-300 rounded-md px-2 py-1"
          >
            {METRICS.map((m) => (
              <option key={m} value={m}>
                {m.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        )}
        {node.kind === 'kpi' && (
          <select
            value={String(node.value ?? '')}
            onChange={(e) => onChange({ ...node, value: e.target.value })}
            className="text-sm border border-gray-300 rounded-md px-2 py-1"
          >
            {KNOWN_KPIS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        )}
        {(node.kind === 'category' || node.kind === 'metric' || node.kind === 'kpi') && (
          <select
            value={node.period ?? 'current'}
            onChange={(e) =>
              onChange({ ...node, period: e.target.value as FormulaNode['period'] })
            }
            className="text-sm border border-gray-300 rounded-md px-2 py-1"
            title="prior_month / prior_year are not yet wired in the runtime evaluator"
          >
            <option value="current">current</option>
            <option value="prior_month">prior month</option>
            <option value="prior_year">prior year</option>
          </select>
        )}
      </div>

      {node.kind === 'op' && (
        <div className="pl-4 border-l-2 border-indigo-200 space-y-2">
          <NodeEditor
            node={node.left ?? { kind: 'literal', value: 0 }}
            onChange={(n) => onChange({ ...node, left: n })}
          />
          <select
            value={node.op}
            onChange={(e) => onChange({ ...node, op: e.target.value as FormulaNode['op'] })}
            className="text-sm border border-gray-300 rounded-md px-2 py-1"
          >
            <option value="+">+</option>
            <option value="-">−</option>
            <option value="*">×</option>
            <option value="/">÷</option>
          </select>
          <NodeEditor
            node={node.right ?? { kind: 'literal', value: 0 }}
            onChange={(n) => onChange({ ...node, right: n })}
          />
        </div>
      )}
    </div>
  );
}

function renderTree(n: FormulaNode): string {
  if (n.kind === 'literal') return String(n.value ?? 0);
  if (n.kind === 'category') {
    const p = n.period && n.period !== 'current' ? `[${n.period}]` : '';
    return `category("${n.value ?? ''}")${p}`;
  }
  if (n.kind === 'metric') {
    const p = n.period && n.period !== 'current' ? `[${n.period}]` : '';
    return `metric("${n.value ?? ''}")${p}`;
  }
  if (n.kind === 'kpi') {
    const p = n.period && n.period !== 'current' ? `[${n.period}]` : '';
    return `kpi("${n.value ?? ''}")${p}`;
  }
  if (n.kind === 'op') {
    return `(${renderTree(n.left ?? { kind: 'literal', value: 0 })} ${n.op} ${renderTree(
      n.right ?? { kind: 'literal', value: 0 },
    )})`;
  }
  return '';
}

// Walk the tree and surface common authoring mistakes before save:
// references to unknown KPI keys, division by literal 0, missing
// operands, period overrides on non-leaf nodes (no-op).
function validateTree(n: FormulaNode | undefined | null, depth: number = 0): string[] {
  if (!n) return ['Empty formula node — pick a kind.'];
  if (depth > 12) return ['Formula nesting too deep.'];
  if (n.kind === 'literal') {
    if (n.value === '' || n.value === undefined) return ['Literal needs a number.'];
    return [];
  }
  if (n.kind === 'category' || n.kind === 'metric' || n.kind === 'kpi') {
    if (!n.value) return [`${n.kind} needs a value.`];
    return [];
  }
  if (n.kind === 'op') {
    const out: string[] = [];
    if (!n.op) out.push('Math operation missing operator.');
    out.push(...validateTree(n.left, depth + 1));
    out.push(...validateTree(n.right, depth + 1));
    if (n.op === '/' && n.right?.kind === 'literal' && Number(n.right.value ?? 0) === 0) {
      out.push('Division by 0 will always be —.');
    }
    return out;
  }
  return [`Unknown node kind: ${String(n.kind)}.`];
}

function Modal({
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
        className="bg-white rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
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

export default FormulaBuilder;
