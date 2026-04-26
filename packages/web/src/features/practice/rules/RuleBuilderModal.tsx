// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type {
  ActionsField,
  ConditionAST,
  ConditionalRule,
  FirmRole,
  RuleScope,
} from '@kis-books/shared';
import { Button } from '../../../components/ui/Button';
import { ConditionNode } from './builder/ConditionNode';
import { ActionsEditor } from './builder/ActionsEditor';
import { JsonPreview } from './builder/JsonPreview';
import { SandboxTab } from './sandbox/SandboxTab';
import { StatsTab } from './stats/StatsTab';
import { TIER_TOOLTIPS } from './TierBadge';
import {
  useCreateConditionalRule,
  useUpdateConditionalRule,
  type CreateConditionalRuleWireInput,
} from '../../../api/hooks/useConditionalRules';

interface Props {
  open: boolean;
  // null = create mode; otherwise the rule being edited.
  // The Stats tab is hidden in create mode (no audit history yet).
  rule: (ConditionalRule & { stats?: { firesTotal: number; fires30d: number; fires7d: number; overrides: number; overrideRate: number | null; lastFiredAt: string | null; ruleId: string; tenantId: string; name: string; } | null }) | null;
  // 3-tier rules plan, Phase 5 — caller's role inside the
  // managing firm. Null on solo books or non-firm members.
  // Drives tier selector availability.
  firmRole?: FirmRole | null;
  onClose: () => void;
}

type ModalTab = 'builder' | 'sandbox' | 'stats';

const EMPTY_CONDITION: ConditionAST = {
  type: 'group',
  op: 'AND',
  children: [{ type: 'leaf', field: 'descriptor', operator: 'contains', value: '' }],
};

const EMPTY_ACTIONS: ActionsField = [{ type: 'set_account', accountId: '' }];

// Phase 5a §5.2-5.4 — modal hosting the recursive builder. Two
// panes: Visual (left) and JSON (right, toggleable view/edit).
// On save, the modal POSTs/PUTs the assembled rule. Server-side
// Zod is the source of truth for validation; surface errors as
// inline text rather than blocking the submit until edit time.
export function RuleBuilderModal({ open, rule, firmRole, onClose }: Props) {
  const [name, setName] = useState('');
  const [priority, setPriority] = useState(100);
  const [active, setActive] = useState(true);
  const [continueAfterMatch, setContinueAfterMatch] = useState(false);
  const [conditions, setConditions] = useState<ConditionAST>(EMPTY_CONDITION);
  const [actions, setActions] = useState<ActionsField>(EMPTY_ACTIONS);
  // 3-tier rules plan, Phase 5 — tier selector. Default
  // tenant_user; firm staff get tenant_firm enabled; firm admins
  // get global_firm enabled too. Rule edits keep the existing
  // scope (tier transitions go through the dedicated promote /
  // demote endpoints rather than the generic update path).
  const [scope, setScope] = useState<RuleScope>('tenant_user');
  const [jsonMode, setJsonMode] = useState<'view' | 'edit'>('view');
  const [jsonValid, setJsonValid] = useState(true);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ModalTab>('builder');

  const create = useCreateConditionalRule();
  const update = useUpdateConditionalRule();

  // Hydrate from `rule` when the modal opens. When `rule` is
  // null (create flow), reset to the empty defaults so a stale
  // edit doesn't leak into a fresh create.
  useEffect(() => {
    if (!open) return;
    if (rule) {
      setName(rule.name);
      setPriority(rule.priority);
      setActive(rule.active);
      setContinueAfterMatch(rule.continueAfterMatch);
      setConditions(rule.conditions);
      setActions(rule.actions);
      setScope(rule.scope);
    } else {
      setName('');
      setPriority(100);
      setActive(true);
      setContinueAfterMatch(false);
      setConditions(EMPTY_CONDITION);
      setActions(EMPTY_ACTIONS);
      setScope('tenant_user');
    }
    setJsonMode('view');
    setJsonValid(true);
    setJsonError(null);
    setSubmitError(null);
    setActiveTab('builder');
  }, [open, rule]);

  // Escape-to-close + body scroll lock. The original click-outside
  // backdrop handler stays — these are additive a11y wins.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleApplyJson = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as { conditions?: ConditionAST; actions?: ActionsField };
      if (parsed.conditions) setConditions(parsed.conditions);
      if (parsed.actions) setActions(parsed.actions);
      setJsonMode('view');
      setSubmitError(null);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  };

  const handleToggleJsonMode = () => {
    if (jsonMode === 'edit' && !jsonValid) return; // blocked by invalid JSON
    setJsonMode((m) => (m === 'view' ? 'edit' : 'view'));
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    const payload: CreateConditionalRuleWireInput = {
      name: name.trim(),
      priority,
      active,
      continueAfterMatch,
      conditions,
      actions,
      // Only include scope on create. Edits don't change tier;
      // the API ignores scope on PUT and the user moves tiers
      // through the dedicated promote / demote modals.
      ...(rule ? {} : { scope }),
    };
    try {
      if (rule) {
        await update.mutateAsync({ id: rule.id, patch: payload });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {rule ? 'Edit Rule' : 'New Conditional Rule'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Phase 5b — tab nav. Sandbox is always available; Stats
            only after the rule is saved (audit history needs an id). */}
        <div className="flex items-center gap-1 px-5 border-b border-gray-200">
          {(['builder', 'sandbox', 'stats'] as ModalTab[]).map((t) => {
            const disabled = t === 'stats' && !rule;
            const label = t.charAt(0).toUpperCase() + t.slice(1);
            return (
              <button
                key={t}
                type="button"
                onClick={() => setActiveTab(t)}
                disabled={disabled}
                title={disabled ? 'Save the rule to view stats' : undefined}
                className={
                  '-mb-px inline-flex items-center px-3 py-2 border-b-2 text-sm font-medium transition-colors ' +
                  (activeTab === t
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700') +
                  (disabled ? ' opacity-30 cursor-not-allowed' : '')
                }
              >
                {label}
              </button>
            );
          })}
        </div>

        {activeTab === 'sandbox' && (
          <div className="flex-1 overflow-auto p-5">
            <SandboxTab conditions={conditions} actions={actions} />
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="flex-1 overflow-auto p-5">
            <StatsTab ruleId={rule?.id ?? null} stats={(rule?.stats as Parameters<typeof StatsTab>[0]['stats']) ?? null} />
          </div>
        )}

        {activeTab === 'builder' && (
        <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
          <div className="md:col-span-2 flex flex-col gap-4">
            {/* 3-tier rules plan, Phase 5 — tier selector.
                Hidden in edit mode (tier transitions go through
                promote/demote). Hidden when the user has no firm
                role, since only tenant_user is meaningful. */}
            {!rule && firmRole && (
              <fieldset className="flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
                <legend className="text-xs font-semibold uppercase tracking-wider text-gray-700 px-1">
                  Tier
                </legend>
                <div className="flex flex-wrap gap-3">
                  {(['tenant_user', 'tenant_firm', 'global_firm'] as const).map((s) => {
                    const disabled =
                      (s === 'tenant_firm' && firmRole === 'firm_readonly') ||
                      (s === 'global_firm' && firmRole !== 'firm_admin');
                    return (
                      <label
                        key={s}
                        className={
                          'flex items-start gap-2 text-sm cursor-pointer ' +
                          (disabled ? 'opacity-50 cursor-not-allowed' : '')
                        }
                      >
                        <input
                          type="radio"
                          name="rule-scope"
                          value={s}
                          checked={scope === s}
                          disabled={disabled}
                          onChange={() => setScope(s)}
                          className="mt-0.5"
                        />
                        <span className="flex flex-col">
                          <span className="font-medium text-gray-900">
                            {s === 'tenant_user' ? 'Mine' : s === 'tenant_firm' ? 'Firm' : 'Global'}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {TIER_TOOLTIPS[s]}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {scope === 'global_firm' && (
                  <p className="text-[11px] text-amber-700">
                    Global rules use account <code className="font-mono">system_tag</code>{' '}
                    handles to resolve targets per-tenant. Pick accounts that have a
                    matching tag in every managed tenant&apos;s Chart of Accounts.
                  </p>
                )}
              </fieldset>
            )}

            {/* Header fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-700">Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
                  maxLength={255}
                  placeholder="e.g. Amazon → Office Supplies"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-700">Priority</span>
                <input
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(Number(e.target.value))}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm font-mono w-24"
                  min={0}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                <span className="text-sm text-gray-700">Active</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={continueAfterMatch}
                  onChange={(e) => setContinueAfterMatch(e.target.checked)}
                />
                <span className="text-sm text-gray-700">Continue after match (additive)</span>
              </label>
            </div>

            {/* Conditions */}
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Conditions</h3>
              <ConditionNode node={conditions} onChange={setConditions} isRoot />
            </section>

            {/* Actions */}
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Actions</h3>
              <ActionsEditor value={actions} onChange={setActions} />
            </section>
          </div>

          {/* JSON pane */}
          <aside className="flex flex-col gap-2 min-h-[400px]">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">JSON</h3>
              <button
                type="button"
                onClick={handleToggleJsonMode}
                disabled={jsonMode === 'edit' && !jsonValid}
                className="text-xs text-indigo-600 hover:text-indigo-800 underline disabled:opacity-50 disabled:no-underline"
              >
                {jsonMode === 'view' ? 'Edit JSON' : 'Apply & switch back'}
              </button>
            </div>
            <JsonPreview
              value={{ conditions, actions }}
              mode={jsonMode}
              onApply={handleApplyJson}
              onValidityChange={(valid, err) => {
                setJsonValid(valid);
                setJsonError(err);
              }}
            />
            {jsonError && jsonMode === 'edit' && (
              <p className="text-xs text-rose-700">Switch back blocked: {jsonError}</p>
            )}
          </aside>
        </div>
        )}

        <div className="flex items-center justify-between gap-2 px-5 py-3 border-t border-gray-200">
          <div>
            {submitError && <span className="text-xs text-rose-700">{submitError}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={create.isPending || update.isPending || !name.trim()}
            >
              {create.isPending || update.isPending ? 'Saving…' : rule ? 'Save changes' : 'Create rule'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
