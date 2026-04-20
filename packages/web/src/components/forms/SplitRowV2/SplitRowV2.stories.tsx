// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.
//
// Build-plan Phase 6 — <SplitRowV2> story coverage.
//
// Format: CSF3 (Component Story Format v3), the pattern shared by
// Storybook 7+ and Ladle. No story runner is installed in this repo
// yet, so these exports are wired into the dev-only visual gallery
// at `src/features/__dev__/SplitRowV2Gallery.tsx` (enabled in dev
// builds by importing the gallery route). When a story runner is
// later added the same exports register without modification.
//
// Every required state from the plan appears below:
//   - empty (no splits yet)
//   - a single row
//   - many rows
//   - with / without tag
//   - uniform tags across rows
//   - mixed tags across rows
//   - error state on a row

import type { ReactNode } from 'react';
import { SplitRowV2 } from './SplitRowV2';

export default {
  title: 'Forms / SplitRowV2',
  component: SplitRowV2,
};

// Lightweight placeholders so stories don't depend on AccountSelector /
// LineTagPicker runtime providers. Real forms inject those via the
// line1 / line2 slots; the stories only need shapes.
function MockInput({ label, placeholder, value }: { label: string; placeholder?: string; value?: string }) {
  return (
    <label className="flex-1 min-w-0 flex flex-col text-xs text-gray-500">
      <span className="sr-only">{label}</span>
      <input
        defaultValue={value ?? ''}
        placeholder={placeholder ?? label}
        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
      />
    </label>
  );
}

function MockAmount({ value = '' }: { value?: string }) {
  return (
    <input
      defaultValue={value}
      placeholder="$0.00"
      inputMode="decimal"
      className="w-36 rounded-md border border-gray-300 px-2 py-1.5 text-sm text-right font-mono tabular-nums"
    />
  );
}

function MockTag({ label }: { label: string }) {
  return (
    <span className="w-40 inline-flex items-center justify-between rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700">
      {label}
    </span>
  );
}

function noop() {}

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs uppercase tracking-wide text-gray-500 font-medium">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function Empty() {
  return (
    <Frame title="Empty — no splits yet">
      <div className="rounded-md border border-dashed border-gray-300 p-6 text-sm text-gray-400">
        No splits. Forms render an "Add split" call-to-action in this state.
      </div>
    </Frame>
  );
}

export function SingleRow() {
  return (
    <Frame title="Single row">
      <SplitRowV2
        index={0}
        total={1}
        isFirst
        onDuplicate={noop}
        onDelete={noop}
        onApplyTagToAll={noop}
        line1={
          <>
            <MockInput label="Category" placeholder="Select account" />
            <MockAmount value="250.00" />
          </>
        }
        line2={
          <>
            <MockInput label="Description" placeholder="Line description" />
            <MockTag label="No tag" />
          </>
        }
      />
    </Frame>
  );
}

export function ManyRowsUniformTag() {
  const rows = [
    { amount: '150.00', desc: 'Hosting — Jan' },
    { amount: '150.00', desc: 'Hosting — Feb' },
    { amount: '150.00', desc: 'Hosting — Mar' },
    { amount: '150.00', desc: 'Hosting — Apr' },
  ];
  return (
    <Frame title="Many rows — uniform tag">
      {rows.map((r, i) => (
        <SplitRowV2
          key={i}
          index={i}
          total={rows.length}
          isFirst={i === 0}
          onDuplicate={noop}
          onDelete={noop}
          {...(i === 0 ? { onApplyTagToAll: noop } : {})}
          line1={
            <>
              <MockInput label="Category" value="Software" />
              <MockAmount value={r.amount} />
            </>
          }
          line2={
            <>
              <MockInput label="Description" value={r.desc} />
              <MockTag label="Project: Acme" />
            </>
          }
        />
      ))}
    </Frame>
  );
}

export function ManyRowsMixedTags() {
  const rows = [
    { amount: '300.00', desc: 'Q1 retainer', tag: 'Project: Acme' },
    { amount: '120.00', desc: 'Ad-hoc request', tag: 'Project: Beta' },
    { amount:  '80.00', desc: 'Misc',           tag: 'No tag'        },
  ];
  return (
    <Frame title="Many rows — mixed tags">
      {rows.map((r, i) => (
        <SplitRowV2
          key={i}
          index={i}
          total={rows.length}
          isFirst={i === 0}
          onDuplicate={noop}
          onDelete={noop}
          {...(i === 0 ? { onApplyTagToAll: noop } : {})}
          line1={
            <>
              <MockInput label="Category" value="Consulting" />
              <MockAmount value={r.amount} />
            </>
          }
          line2={
            <>
              <MockInput label="Description" value={r.desc} />
              <MockTag label={r.tag} />
            </>
          }
        />
      ))}
    </Frame>
  );
}

export function ActiveRow() {
  return (
    <Frame title="Active row (keyboard focus / current selection)">
      <SplitRowV2
        index={0}
        total={2}
        isFirst
        isActive
        onDuplicate={noop}
        onDelete={noop}
        onApplyTagToAll={noop}
        line1={
          <>
            <MockInput label="Category" value="Marketing" />
            <MockAmount value="1,200.00" />
          </>
        }
        line2={
          <>
            <MockInput label="Description" value="Campaign spend" />
            <MockTag label="Project: Acme" />
          </>
        }
      />
      <SplitRowV2
        index={1}
        total={2}
        onDuplicate={noop}
        onDelete={noop}
        line1={
          <>
            <MockInput label="Category" value="Marketing" />
            <MockAmount value="300.00" />
          </>
        }
        line2={
          <>
            <MockInput label="Description" value="Creative" />
            <MockTag label="Project: Acme" />
          </>
        }
      />
    </Frame>
  );
}

export function ErrorState() {
  return (
    <Frame title="Error state — line-level validation failure">
      <SplitRowV2
        index={0}
        total={1}
        isFirst
        onDuplicate={noop}
        onDelete={noop}
        errorMessage="Amount must be greater than zero"
        line1={
          <>
            <MockInput label="Category" value="Expense: Meals" />
            <MockAmount value="0.00" />
          </>
        }
        line2={
          <>
            <MockInput label="Description" value="Team lunch" />
            <MockTag label="No tag" />
          </>
        }
      />
    </Frame>
  );
}

export function CompactDensity() {
  return (
    <Frame title="Compact density — Register / Batch-Entry surfaces">
      <SplitRowV2
        index={0}
        total={1}
        density="compact"
        line1={
          <>
            <MockInput label="Category" value="Office supplies" />
            <MockAmount value="42.99" />
          </>
        }
        line2={
          <>
            <MockInput label="Description" value="Paper, pens" />
            <MockTag label="Project: Acme" />
          </>
        }
      />
    </Frame>
  );
}

// Full gallery: renders every variant top-to-bottom. Useful as the
// default story when browsing the component visually.
export function Gallery() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto p-6">
      <Empty />
      <SingleRow />
      <ManyRowsUniformTag />
      <ManyRowsMixedTags />
      <ActiveRow />
      <ErrorState />
      <CompactDensity />
    </div>
  );
}
