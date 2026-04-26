// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import {
  CONDITION_FIELDS,
  CONDITION_FIELDS_DEFERRED,
  FIELD_OPERATOR_MAP,
  type ConditionField,
  type LeafCondition,
} from '@kis-books/shared';
import { Trash2 } from 'lucide-react';
import { useBankSourceAccounts } from '../../../../api/hooks/useRuleTestSandbox';

interface Props {
  node: LeafCondition;
  onChange: (next: LeafCondition) => void;
  onRemove: () => void;
}

// Phase 5a §5.2 — leaf condition editor. Three controls:
// field, operator (filtered by field's operator family), value
// (input shape adapts to field type — text / number / date /
// between-tuple / day-of-week dropdown).
//
// Deferred fields (class_id, location_id) are filtered out of
// the dropdown so an author can't construct a rule the engine
// will refuse at evaluation time.
export function LeafConditionEditor({ node, onChange, onRemove }: Props) {
  const availableFields = CONDITION_FIELDS.filter(
    (f) => !(CONDITION_FIELDS_DEFERRED as readonly string[]).includes(f),
  );
  const operators = FIELD_OPERATOR_MAP[node.field] ?? [];

  const handleFieldChange = (nextField: ConditionField) => {
    // When field changes, the previous operator may no longer be
    // valid. Default to the first operator of the new family;
    // value resets too because its type may not match.
    const nextOps = FIELD_OPERATOR_MAP[nextField] ?? [];
    const nextOperator = nextOps[0] ?? 'equals';
    onChange({
      type: 'leaf',
      field: nextField,
      operator: nextOperator,
      value: defaultValueForOperator(nextField, nextOperator),
    });
  };

  const handleOperatorChange = (nextOperator: string) => {
    onChange({
      ...node,
      operator: nextOperator,
      value: defaultValueForOperator(node.field, nextOperator),
    });
  };

  return (
    <div className="flex items-start gap-2 rounded-md border border-gray-200 bg-white p-2">
      <div className="grid flex-1 gap-2 md:grid-cols-3">
        <select
          value={node.field}
          onChange={(e) => handleFieldChange(e.target.value as ConditionField)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
          aria-label="Field"
        >
          {availableFields.map((f) => (
            <option key={f} value={f}>{prettyField(f)}</option>
          ))}
        </select>
        <select
          value={node.operator}
          onChange={(e) => handleOperatorChange(e.target.value)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
          aria-label="Operator"
        >
          {operators.map((op) => (
            <option key={op} value={op}>{prettyOperator(op)}</option>
          ))}
        </select>
        <ValueInput
          field={node.field}
          operator={node.operator}
          value={node.value}
          onChange={(v) => onChange({ ...node, value: v })}
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove condition"
        className="rounded-md p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function ValueInput({
  field,
  operator,
  value,
  onChange,
}: {
  field: ConditionField;
  operator: string;
  value: unknown;
  onChange: (v: LeafCondition['value']) => void;
}) {
  const baseClass = 'rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm w-full';

  // `between` always takes a 2-tuple; render two side-by-side
  // inputs of the matching primitive type.
  if (operator === 'between') {
    const isDate = field === 'date';
    const tuple = Array.isArray(value) && value.length === 2 ? (value as Array<unknown>) : ['', ''];
    return (
      <div className="flex items-center gap-1">
        <input
          type={isDate ? 'date' : 'number'}
          value={String(tuple[0] ?? '')}
          onChange={(e) => onChange([e.target.value, String(tuple[1] ?? '')] as Parameters<typeof onChange>[0])}
          className={baseClass}
        />
        <span className="text-xs text-gray-400">–</span>
        <input
          type={isDate ? 'date' : 'number'}
          value={String(tuple[1] ?? '')}
          onChange={(e) => onChange([String(tuple[0] ?? ''), e.target.value] as Parameters<typeof onChange>[0])}
          className={baseClass}
        />
      </div>
    );
  }

  if (field === 'day_of_week' || operator === 'on_day_of_week') {
    return (
      <select
        value={String(value ?? '')}
        onChange={(e) => onChange(Number(e.target.value))}
        className={baseClass}
      >
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
          <option key={d} value={i}>{d}</option>
        ))}
      </select>
    );
  }

  if (field === 'date') {
    return (
      <input
        type="date"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className={baseClass}
      />
    );
  }

  if (field === 'amount' || field === 'amount_sign') {
    return (
      <input
        type="number"
        step="0.01"
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className={baseClass}
      />
    );
  }

  if (field === 'account_source_id') {
    return <BankSourceAccountInput value={value} onChange={onChange} className={baseClass} />;
  }

  return (
    <input
      type="text"
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      className={baseClass}
      placeholder={operator === 'matches_regex' ? 'regex pattern' : undefined}
    />
  );
}

// Friendly bank-connection picker for the `account_source_id`
// condition field. The persisted value is the GL account uuid
// (what the engine compares); the UI shows the institution name +
// account name so the bookkeeper picks by familiar label.
function BankSourceAccountInput({
  value,
  onChange,
  className,
}: {
  value: unknown;
  onChange: (v: LeafCondition['value']) => void;
  className: string;
}) {
  const { data, isLoading } = useBankSourceAccounts();
  const current = String(value ?? '');
  const accounts = data?.accounts ?? [];
  const knownIds = new Set(accounts.map((a) => a.accountId));
  return (
    <select
      value={current}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      aria-label="Bank source account"
    >
      <option value="">{isLoading ? 'Loading…' : 'Pick a bank account…'}</option>
      {accounts.map((a) => (
        <option key={a.accountId} value={a.accountId}>
          {a.institutionName ? `${a.institutionName} — ` : ''}
          {a.accountName}
          {a.mask ? ` (****${a.mask})` : ''}
        </option>
      ))}
      {/* Surface a non-matching uuid (legacy rule that pre-dates
          the picker) so the author can re-bind without losing data. */}
      {current && !knownIds.has(current) && (
        <option value={current}>{current.slice(0, 8)}… (unknown)</option>
      )}
    </select>
  );
}

function defaultValueForOperator(field: ConditionField, operator: string): LeafCondition['value'] {
  if (operator === 'between') return ['', ''] as string[];
  if (field === 'amount' || field === 'amount_sign') return 0;
  if (field === 'day_of_week' || operator === 'on_day_of_week') return 0;
  return '';
}

function prettyField(f: string): string {
  return f.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function prettyOperator(op: string): string {
  // Replace not_x with "not x" and underscores with spaces.
  return op.replace(/^not_/, 'not ').replace(/_/g, ' ');
}
