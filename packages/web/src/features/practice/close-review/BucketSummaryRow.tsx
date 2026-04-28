// Copyright 2026 Kisaes LLC
// Licensed under the PolyForm Internal Use License 1.0.0.
// You may not distribute this software. See LICENSE for terms.

import { Target, Scale, Sparkles, AlertCircle, Flag } from 'lucide-react';
import type { BucketSummary, ClassificationBucket } from '@kis-books/shared';
import clsx from 'clsx';

export interface BucketTileProps {
  label: string;
  count: number;
  tone: 'indigo' | 'green' | 'amber' | 'red' | 'gray';
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  onClick?: () => void;
}

const TONE_CLASSES: Record<BucketTileProps['tone'], { bg: string; text: string; border: string }> = {
  indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  green: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  red: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  gray: { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' },
};

function BucketTile({ label, count, tone, icon: Icon, active, onClick }: BucketTileProps) {
  const colors = TONE_CLASSES[tone];
  const Element = onClick ? 'button' : 'div';
  return (
    <Element
      onClick={onClick}
      className={clsx(
        'flex flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left transition-colors',
        colors.border,
        colors.bg,
        onClick && 'hover:border-gray-400',
        active && 'ring-2 ring-offset-1 ring-gray-900',
      )}
    >
      <div className={clsx('flex items-center gap-2', colors.text)}>
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <span className={clsx('text-2xl font-semibold', colors.text)}>{count}</span>
    </Element>
  );
}

export const BUCKET_LABELS: Record<ClassificationBucket, string> = {
  potential_match: 'Potential Matches',
  rule: 'Rules',
  auto_high: 'Auto: High',
  auto_medium: 'Auto: Medium',
  needs_review: 'Needs Review',
};

interface Props {
  summary: BucketSummary | undefined;
  activeBucket?: ClassificationBucket | null;
  onBucketClick?: (bucket: ClassificationBucket) => void;
}

// Five bucket tiles + a findings tile (Phase-6 placeholder). The
// four bucket tiles collapse 'auto_high' + 'auto_medium' into
// one "Auto" tile per the build plan summary row spec; detailed
// High / Medium breakdown happens inside Bucket 3's sub-tabs.
// Potential Matches renders even when empty so bookkeepers
// understand Phase 3 will populate this surface.
export function BucketSummaryRow({ summary, activeBucket, onBucketClick }: Props) {
  const autoTotal = (summary?.buckets.auto_high ?? 0) + (summary?.buckets.auto_medium ?? 0);
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <BucketTile
        label={BUCKET_LABELS.potential_match}
        count={summary?.buckets.potential_match ?? 0}
        tone="indigo"
        icon={Target}
        active={activeBucket === 'potential_match'}
        onClick={onBucketClick ? () => onBucketClick('potential_match') : undefined}
      />
      <BucketTile
        label={BUCKET_LABELS.rule}
        count={summary?.buckets.rule ?? 0}
        tone="green"
        icon={Scale}
        active={activeBucket === 'rule'}
        onClick={onBucketClick ? () => onBucketClick('rule') : undefined}
      />
      <BucketTile
        label="Auto Classifications"
        count={autoTotal}
        tone="amber"
        icon={Sparkles}
        active={activeBucket === 'auto_high' || activeBucket === 'auto_medium'}
        onClick={onBucketClick ? () => onBucketClick('auto_high') : undefined}
      />
      <BucketTile
        label={BUCKET_LABELS.needs_review}
        count={summary?.buckets.needs_review ?? 0}
        tone="red"
        icon={AlertCircle}
        active={activeBucket === 'needs_review'}
        onClick={onBucketClick ? () => onBucketClick('needs_review') : undefined}
      />
      <BucketTile
        label="Findings"
        count={summary?.findingsCount ?? 0}
        tone="gray"
        icon={Flag}
      />
    </div>
  );
}
